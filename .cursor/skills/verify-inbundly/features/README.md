# Inbundly verification map

This directory is the maintained source for verifying Inbundly's user-facing behavior.
Read this index before driving, then follow the matching feature file as the recipe. The
rows in `TESTING.md` are the wider test plan; the files here are the subset an agent can
drive end to end with the Playwright harness.

## Baseline preconditions

- Run `scripts/verify.sh launch` then `scripts/verify.sh doctor` from the repo root and
  require every `ok` line plus the probe's `worth driving`.
- Every drive gets a fresh Chromium profile under `${TMPDIR:-/tmp}/inbundly-verify/<RUN_ID>/`,
  so `chrome.storage.sync` starts empty and every option is at its default
  (`bundlingEnabled`, `keepStarredUnbundled`, `senderBundling`, `rememberOpenBundle`,
  `showBundleArchive`, `showBundleSnooze` on; `showBundleDelete` off).
- The inbox is the fixture served at `https://mail.google.com/mail/u/0/#inbox` with the
  thread list named in each feature file; the walk in `scripts/drive.js` seeds it.
- Never drive a Chrome you did not start; the harness's own `launchWithExtension()` is
  the only way in.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer the extension's own handles: ARIA names (`Select all messages in this bundle`),
  Inbundly classes (`.bundle-row`, `.bundle-count`, `.bundled-message.visible`,
  `.bundle-area`, `.view-all-link`, `.archive-bundle`, `.snooze-bundle`, `.delete-bundle`),
  and the `<html>` state classes (`hide-bundle-delete`, `hide-bundle-snooze`,
  `hide-bundle-archive`, `bundling-disabled`). Gmail classes (`tr.zA`, `x7`, `.G-Ni`) are
  the fixture contract from `src/util/Constants.js`; treat them as read-only assertions.
- Bundle rows and Options switches take real `click()`s. Bundle action icons are
  hover-revealed: hover the bundle row first, then click the icon. Native row checkboxes
  in the fixture are toggled the synthetic way the specs use (`.oZ-jc` `.click()` in
  `page.evaluate`) because a real click would go through Gmail's quick-select handler.
- Option flips outside the Options page go through `setSyncOptions(context, {...})`
  from `e2e/helpers/gmail.js`; that is the production sync boundary, not a test hook.
- Treat every command as literal. Keep names, labels, and option keys unchanged.
- Restore state a recipe changed (options flipped, selections made) before ending it;
  never remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen: the walk
  saves a screenshot and an ARIA snapshot after every step.
- Pair each visible result with its side effect: `sessionStorage['inbundly:openBundle:v1']`,
  `chrome.storage.sync` (read through the service worker), `window.__gmail.clicks`.
- Record the feature id, the step name, and the evidence path with every claim.
- Report an unreachable path with the attempted command and the unmet precondition. Live
  Gmail rows in `TESTING.md` (marked manual) are out of scope here; say so rather than
  reporting them as covered by the fixture.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible
behavior, then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Playwright` starts with `Preconditions:` and uses labeled bullets
   that pair each user action with an exact command or locator and the observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles,
required state, commands, and observable proof.

## Features

- [Core bundling](./core-bundling.md) covers bundle rows forming per label, expand and
  collapse in place, outside-click close, plain rows for loose threads, and date dividers
  (`TESTING.md` 1.1, 1.2, 1.3, 1.5, 2.5, 2.7, 7.1).
- [Bundle actions](./bundle-actions.md) covers the bundle checkbox, partial selection,
  archive-all, snooze-all, delete-all, the disable rule for outside selections, and the
  live show/hide options (`TESTING.md` 5.1 to 5.5, 5.9 to 5.11, 10.4).
- [Sender bundles](./sender-bundles.md) covers domain and freemail-address bundles for
  unlabeled threads, label precedence, single-thread senders, uncolored rows, and the
  `View all` search link (`TESTING.md` 3.1 to 3.5, 8.4).
- [Remember the open bundle](./remember-open-bundle.md) covers reopening after a reload,
  forgetting on collapse or backdrop close, and the session store behind it
  (`TESTING.md` 4.1 to 4.3).
- [Options autosave and live sync](./options-autosave.md) covers flipping a switch on the
  real Options page, per-key auto-save, persistence across reload, and the Gmail tab
  reacting live (`TESTING.md` 10.3, 10.4, 10.7).
