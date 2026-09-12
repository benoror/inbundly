---
name: verify-inbundly
description: "Drive Inbundly (the Gmail bundles browser extension) the way a user does and capture proof: the built extension loaded into Playwright Chromium against the repo's Gmail-shaped fixture page, plus the extension's Options page. Use it to prove a bundling, bundle-action, sender-bundle, remember-open-bundle, or options change works before opening or reviewing a PR, or whenever the e2e suite is red and you need evidence of what the user would see."
---

# Verify Inbundly

Inbundly is a Manifest V3 content script that restructures Gmail's message list into
collapsible bundles. There is no server to start: the app is `dist/` (the built
extension), and the only agent-drivable surface is the repo's own Playwright harness,
which loads `dist/` into Chromium and serves a Gmail-shaped fixture at
`https://mail.google.com/mail/u/0/#inbox` through route interception
(`e2e/helpers/gmail.js`, `e2e/fixture/inbox.js`). The extension's Options page
(`chrome-extension://cpggdbckpaoikhddngoeepdedfkleiab/options/options.html`) is drivable in
the same browser context. Live Gmail is out of band for this skill: it needs a signed-in
human Chrome and the manual protocol at the bottom of `TESTING.md`; never report a fixture
run as a live-Gmail pass.

All commands below run from the repo root. `scripts/verify.sh` is the entry point; the
feature map in [`features/`](features/README.md) says what to drive and what proves it.

## Launch

There is no long-running instance. Launch means: dependencies installed, `dist/content.js`
built from the current `src/`, Playwright Chromium present.

```bash
.cursor/skills/verify-inbundly/scripts/verify.sh launch
```

It prints `RUN_ID=<timestamp>` and remembers it in `evidence/.current-run` so the later
steps share one evidence directory; set `RUN_ID=<name>` in the environment to choose
your own. Ready when the last line reads `ok    ready: dist/content.js built; Chromium at
.../chromium-<build>/chrome-linux64/chrome`. What it does, only when needed: `npm install`
(if `node_modules/@playwright/test` is missing), `npm run build` (always; takes about a
second, log in `evidence/<RUN_ID>/build.log`), `npx playwright install chromium` (if the
Chromium binary is missing). On a fresh Linux machine without browser libraries use
`npx playwright install --with-deps chromium` yourself first; it needs sudo, which the
script does not ask for.

Each drive launches its own Chromium with a throwaway profile under
`${TMPDIR:-/tmp}/inbundly-verify/<RUN_ID>/` and closes it when done, so the user's real
Chrome and any other run are never touched. Teardown for the run is the Cleanup section.

## Doctor

```bash
.cursor/skills/verify-inbundly/scripts/verify.sh doctor
```

Read-only checks, each printed as `ok` or `FAIL` with the fix: Node 20 or newer,
`node_modules` present, Playwright Chromium binary present (the harness uses
`channel: 'chromium'`, which needs the full build, not `chromium-headless-shell`),
`dist/content.js` newer than every file under `src/` (stale builds prove the wrong code),
`package.json` and `dist/manifest.json` on the same version, and leftover scratch from
other runs. If all pass it runs one probe: loads the built extension against a two-thread
fixture and confirms the service worker reports the pinned extension id
`cpggdbckpaoikhddngoeepdedfkleiab`, the manifest version, and exactly one `.bundle-row`.
Output is saved to `evidence/<RUN_ID>/doctor.log`. A `FAIL` line means the instance is not
worth driving; fix it (usually `launch` again) before any Drive.

## Drive

Pick the feature from the map, then:

```bash
.cursor/skills/verify-inbundly/scripts/verify.sh drive <feature>
# features: core-bundling bundle-actions sender-bundles remember-open-bundle options-autosave
```

`drive` does two things and fails if either fails:

1. **Walk** (`scripts/drive.js <feature>`): reuses the harness to load the extension,
   serve the feature's fixture inbox, and perform the user's actions step by step, with
   real clicks on the handles a user reaches (bundle rows, the bundle checkbox by its ARIA
   name `Select all messages in this bundle`, hover-revealed action icons, the Options page
   switches). After every step it records the values it checked, a full-page screenshot,
   and an ARIA snapshot of `[role="main"]` (or the Options page body).
2. **Spec**: runs the mapped Playwright spec (`e2e/<name>.spec.js`, plus `-g` filters and
   the jsdom Jest suite where the map says so) with the `list` and `json` reporters into
   the same evidence directory.

For an ad hoc drive, write a throwaway script under `/tmp` that requires
`e2e/helpers/gmail.js` and `e2e/fixture/inbox.js` (set `NODE_PATH=<repo>/node_modules`)
and follow the recipe bullets in the feature file: `launchWithExtension()` then
`serveInbox(context, inboxPage({ threads: [...] }))` then `openInbox(context)`. The stable
handles are the extension's own classes and ARIA names, listed per feature; the fixture's
Gmail emulation records toolbar clicks on `window.__gmail.clicks` and toggles row selection
(`tr.zA.x7`) and the toolbar cluster `.G-Ni` like Gmail does. Do not add a second browser
stack, and do not drive live Gmail from here.

## Evidence

Everything lands in `.cursor/skills/verify-inbundly/evidence/<RUN_ID>/` (gitignored except
its `.gitignore`), one subdirectory per driven feature:

- `NN-<step>-<page>.png` and `NN-<step>-<page>.aria.txt`: state after each user action
  (the action and the resulting state, not just the final screen). The fixture ships no
  Gmail stylesheet, so screenshots are layout-rough (overlapping cells are normal); the
  ARIA snapshot and `walk.md` are the precise record, the screenshot shows what opened.
- `walk.md`, `steps.json`, `result.json`: every check with its observed value and pass/fail;
  `console.log`: page console and page errors, including the extension's
  `inbundly-debug:` lines when `DEBUG` is on.
- `walk.log`, `playwright.log`, `playwright.json` (and `jest.log` where mapped): the spec
  run with exit status per test.
- `RESULT`: `PASS` or `FAIL` for the feature; `../summary.md` accumulates one line per drive.

Proof standards: exercise the user path (click the bundle row, click the switch on the
Options page), not internal setters; the one sanctioned shortcut is
`setSyncOptions(context, {...})` from the harness, which writes `chrome.storage.sync`
through the extension's own service worker, the same boundary a second device would cross.
Verify side effects next to what is visible: `sessionStorage['inbundly:openBundle:v1']`
for the remembered bundle, `chrome.storage.sync` contents for options, `window.__gmail.clicks`
for toolbar actions. A `PASS` from `drive` with all artifacts present is the proof; quote
the evidence path and the feature id when reporting. Skips are reported as skips with the
unmet precondition, never as passes through another path.

## Cleanup

```bash
.cursor/skills/verify-inbundly/scripts/verify.sh cleanup            # current RUN_ID
.cursor/skills/verify-inbundly/scripts/verify.sh cleanup <RUN_ID>   # a specific run
```

Finds processes whose command line contains this run's scratch path (Chromium started
with `--user-data-dir` under `${TMPDIR:-/tmp}/inbundly-verify/<RUN_ID>/`), stops them,
removes the scratch directory, and forgets the current run id. It never kills by process
name and never touches `evidence/`: after cleanup, `ls evidence/<RUN_ID>/` must still show
the artifacts. Run it after every drive, including failed ones, so no profile directories
pile up. Chromium normally exits when the walk or spec closes its context; cleanup is the
safety net for crashed runs. Playwright's own `test-results/` (failure traces) is
gitignored and is left alone.

## Helpers

Both are executable and live in `.cursor/skills/verify-inbundly/scripts/`:

- `verify.sh launch | doctor | drive <feature> | cleanup [RUN_ID] | features`: the runner
  described above. `RUN_ID` and `TMPDIR` are the only knobs.
- `drive.js doctor` and `drive.js <feature> --evidence <dir>`: the Node walker the runner
  calls; run it directly to iterate on a walk. It exits non-zero when any check fails or
  any artifact could not be captured.

Feature walks are plain async functions in `drive.js` (`FEATURES`); adding a feature means
a new entry there, a new `features/<id>.md`, and a `spec_for` line in `verify.sh`. Keep
the feature map honest as the app changes with `/maintain-verification-skill`.
