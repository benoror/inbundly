# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Working agreements

- **Commit atomic changes eagerly.** If a change is small, isolated, semantic, and
  atomic, `git commit` it right away with a meaningful message. If in doubt, ask first.
- **Keep documentation current.** Whenever a change makes it relevant, update the
  README, this file, and any other docs or agentic files so they stay accurate.

## What this is

`inboxy` is a Manifest V3 browser extension (Chrome + Firefox) that recreates Google
Inbox-style bundles in Gmail. It's a fork of
[teresa-ou/inboxy](https://github.com/teresa-ou/inboxy) — the upstream project is no
longer actively maintained. Licensed GPL-3.0.

The extension runs as a content script injected into `mail.google.com`, observing
Gmail's DOM and restructuring the message list into collapsible bundles by label.

## Layout

- `src/` — all editable JavaScript source (ES modules). Entry point: `src/content.js`.
  - `bundling/` — core logic that groups messages into bundles and toggles them
    (`Bundler`, `BundleToggler`, `DateGrouper`, `SelectiveBundling`, `InboxyStyler`).
  - `handlers/` — `MutationObserver`-based watchers that react to Gmail navigation,
    rerenders, starring, and theme changes.
  - `components/` — DOM builders for injected UI (bundle rows, dividers, toggles, the
    bulk-archive button, the floating "Bundle selected" custom-bundle control).
  - `containers/` — in-memory models of the bundled mail state (`BundledMail`,
    `Bundle`, and `CustomBundles` — the persisted, thread-id-keyed custom bundles).
  - `util/` — `Constants.js` (Gmail DOM selectors + inboxy CSS classes) and DOM helpers.
- `dist/` — the loadable unpacked extension. Contains committed static assets
  (`manifest.json`, `style.css`, `background.js`, `popup/`, `options/`, `icons/`,
  `assets/`) plus the webpack-built `content.js`.
- `test/` — Jest tests.

## Build & develop

Webpack bundles **only** `src/content.js` → `dist/content.js`. Everything else in
`dist/` is committed by hand.

```bash
npm install       # one-time: install build deps
npm run build     # one-off build → dist/content.js
npm run watch     # rebuild automatically on save (use this while iterating)
npm test          # Jest tests
```

`dist/content.js` is gitignored (build artifact) — do not commit it.

### Loading in Chrome

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the `dist/` folder.
3. Open `mail.google.com`.

After a rebuild: click **reload ↻** on the inboxy card in `chrome://extensions`, then
refresh Gmail.

### Extension identity (do not change casually)

`dist/manifest.json` pins a `key` (and Firefox `browser_specific_settings.gecko.id`) so
every install resolves to the same extension ID — `cpggdbckpaoikhddngoeepdedfkleiab` —
regardless of the path `dist/` is loaded from. This is what makes `chrome.storage.sync`
reach a user's other computers; without it Chrome derives the ID from the folder path and
each machine silently gets its own settings bucket.

Changing or removing `key` changes the extension ID, which Chrome treats as a **different
extension**: every stored option and custom bundle becomes unreachable. Treat it as a
breaking change, and rely on Options → **Sync & backup** (JSON export/import) to carry
settings across such a move. Only the public key is committed; the matching private key
isn't kept, since unpacked loading doesn't need it (packing a `.crx` would).
`test/ExtensionId.test.js` asserts the key still resolves to that ID, so the change has
to be deliberate.

Note that branded Chrome 137+ removed `--load-extension`, so the extension can't be
side-loaded from the command line for automated checks — use **Load unpacked** on
`chrome://extensions`, or Chrome for Testing / Chromium. `test/OptionsPage.test.js` covers
the options page in jsdom instead, which is why it exists: nothing else executes
`dist/options/options.js`.

## Releasing

This fork runs its **own release line**, independent of upstream teresa-ou/inboxy — we do
**not** propose changes upstream. PRs, tags, and releases all live on `benoror/inboxy`.

Conventions:

- **Semantic versioning** per [semver.org](https://semver.org/spec/v2.0.0.html), tags
  prefixed `v` (e.g. `v2.0.0`). `package.json` and `dist/manifest.json` share one version
  — always bump them together. Choose the bump from what the release contains, not by
  habit: **MAJOR** for backwards-incompatible changes (e.g. dropping/renaming an option or
  storage key, removing a feature), **MINOR** for backwards-compatible new functionality
  (a new feature or option), **PATCH** for backwards-compatible bug fixes only. When a
  release mixes categories, take the highest that applies. If unsure whether a change is
  breaking, ask before tagging.
- The **manifest version is what ships** and Chrome requires plain dotted integers
  (1–4 groups, each 0–65535); **no** pre-release suffixes like `-beta` there. Tags/release
  names may be richer, but keep the numeric core in sync with the manifest.
- Every release gets a `CHANGELOG.md` entry ([Keep a Changelog](https://keepachangelog.com/)
  format: Added / Changed / Fixed).

Flow for landing a feature branch and cutting a release:

1. **PR into the fork.** Open the PR against `benoror/inboxy`'s `master` explicitly —
   `gh` defaults to the upstream parent, so always pass `--repo benoror/inboxy`:
   ```bash
   gh pr create --repo benoror/inboxy --base master --head <feature-branch>
   ```
   Prefer a **merge commit** (`gh pr merge <n> --repo benoror/inboxy --merge`) to preserve
   the branch's atomic-commit history.
2. **Release commit on `master`** (after merge): bump the version in both
   `dist/manifest.json` and `package.json`, add the `CHANGELOG.md` section, commit as
   `Release vX.Y.Z`.
3. **Tag & push:** `git tag -a vX.Y.Z -m "inboxy vX.Y.Z (benoror fork)" && git push origin vX.Y.Z`.
4. **GitHub Release:** `gh release create vX.Y.Z --repo benoror/inboxy --latest --notes-file <notes>`
   (notes = that version's changelog section).

> Running `npm test` from inside a `.claude/worktrees/…` path reports "0 tests": `master`'s
> Jest config ignores `/.claude/`, which matches the worktree's own path. Run tests from the
> main checkout, or override: `npx jest --testPathIgnorePatterns=/node_modules/`.

## Notes

- `src/content.js` has a `DEBUG` flag that logs `inboxy-debug:` messages to the console.
- **Bootstrapping.** `content.js` waits for stored options / custom bundles
  (`optionsReady` / `ready` promises on `Bundler`, `SelectiveBundling`,
  `StarHandler`, `DateGrouper`, `CustomBundles`) before the first
  `tryStart()`, then starts navigation observers as soon as Gmail's
  `role="main"` exists and attempts to bundle. Bundling must not race ahead of
  `chrome.storage.sync.get` — otherwise defaults (e.g. `keepStarredUnbundled:
  true`) stick for the life of the painted list. If the message list isn't
  painted yet (common when navigating back to Inbox), `bundleOrRetry`
  soft-retries via `util/CoalescedRetry.js` instead of throwing. Do not
  reintroduce a fatal timeout that skips `startObservers()` — that leaves the
  tab permanently unbundled.
- Gmail ships no stable API; the extension depends on DOM selectors in
  `src/util/Constants.js`. Gmail markup changes are the usual cause of breakage.
- **Options storage.** Every Options-page setting and custom bundles live in
  `chrome.storage.sync` (Firefox Sync via the same API). Key names and defaults
  are centralized in `src/util/Options.js` (`OPTION_DEFAULTS`,
  `BUNDLING_OPTION_KEYS`, `UI_OPTION_KEYS`). The options page (`dist/options/`)
  is plain JS outside the webpack bundle, so it duplicates the key list as
  `OPTION_KEYS` — keep both lists in sync when adding an option, since the
  duplicate also gates the live-reload listener and JSON import.
- Cross-device sync additionally depends on the pinned extension ID; see
  **Extension identity** above.
- **Live sync.** `content.js` listens to `chrome.storage.onChanged` for the
  sync area. UI-only keys (`showPinnedToggle`, `showBundleArchive`) toggle CSS
  classes on `<html>`; bundling keys call `applyOptions` on `SelectiveBundling`,
  `Bundler`, `StarHandler`, and `DateGrouper`, then refresh Gmail so the list
  rebundles. `keepStarredUnbundled` (default `true`) is a bundling key: when on,
  starred messages stay outside bundles (Inbox-style pinning); when off,
  `StarHandler` skips scroll compensation because starring no longer changes
  layout.
  Custom-bundle membership uses the same listener via
  `CustomBundles.applyStoredValue`. The options page also re-reads the form
  when sync values change remotely.
- **Custom bundles** (ad-hoc groupings with no Gmail label) are keyed by Gmail's
  stable `data-legacy-thread-id` (read via `DomUtils.getThreadId`) and persisted
  in `chrome.storage.sync` by `containers/CustomBundles.js`. Their bundle key is
  the user's name prefixed with `0x1E` (`util/CustomBundleKey.js`) so it flows
  through the label-keyed pipeline without colliding with a real label or a
  combined-label (`0x1F`) key. `SelectiveBundling` checks custom membership first
  (custom wins over priority rules and labels). `options/` reads/writes the same
  storage key directly for management.
- Versioning, tags, and releases are covered under **Releasing** above.
