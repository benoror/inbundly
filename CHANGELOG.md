# Changelog

All notable changes to this fork of inboxy are documented here.

This is the [benoror](https://github.com/benoror/inboxy) fork of the (unmaintained)
[teresa-ou/inboxy](https://github.com/teresa-ou/inboxy). It tracks its own release line,
independent of upstream's versioning. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.1.0] - 2026-08-09

### Added
- **Keep starred messages outside bundles** — new Options → Bundle setup toggle
  (`keepStarredUnbundled`, on by default). Matches the previous Inbox-style pinning
  behavior; turn it off to leave starred messages in their bundles. Live sync applies
  the change, and star-click scroll compensation only runs when the option is enabled.

### Changed
- **Options page reorganization.** Settings are grouped into Bundle setup, Appearance,
  Features, Advanced, Custom bundles, and Sync & backup, with denser controls moved
  under Advanced.

[3.1.0]: https://github.com/benoror/inbundly/releases/tag/v3.1.0

## [3.0.0] - 2026-08-08

### Fixed
- **Settings never synced between computers.** `dist/manifest.json` had no `key`, so
  each unpacked install got an extension ID derived from the folder it was loaded from.
  `chrome.storage.sync` is partitioned per extension ID, so two laptops running the same
  build kept two separate, never-syncing copies of the options. The manifest now pins a
  `key` (extension ID `cpggdbckpaoikhddngoeepdedfkleiab`) plus a Firefox
  `browser_specific_settings.gecko.id`.

### Added
- **Options → Sync & backup** — shows the extension ID this install is using (it must
  match across computers for sync to work) and exports/imports all settings and custom
  bundles as a JSON file, for moving them when sync is unavailable.
- Jest coverage for the options page itself (`test/OptionsPage.test.js` runs the real
  `dist/options/options.js` against the real markup in jsdom) and for the pinned
  extension ID (`test/ExtensionId.test.js`).

### ⚠️ Breaking
- The pinned `key` **changes the extension ID**, so Chrome treats this as a new
  extension: options and custom bundles saved under the previous per-machine ID are not
  carried over. Before updating, export your settings (Options → Sync & backup, or just
  copy the Priority/label lists), then re-save or import once on the new build. This is
  the one-time cost of getting sync to work across devices from here on.

[3.0.0]: https://github.com/benoror/inbundly/releases/tag/v3.0.0

## [2.1.1] - 2026-08-08

### Changed
- **All options sync live across devices.** Settings were already stored in
  `chrome.storage.sync` (and Firefox Sync via the same API); Gmail tabs and the
  options page now apply remote changes immediately — bundling rules, colors,
  feature toggles, and custom bundles — instead of only picking them up after a
  reload. Defaults/key groups live in `src/util/Options.js`.

### Fixed
- **Inbox sometimes left unbundled after navigation.** `tryBundling` used to throw
  after ~5s if Gmail's message list wasn't painted yet, which also skipped starting
  the navigation observers — so returning to Inbox never recovered without a full
  refresh. Observers now start as soon as Gmail's main UI exists, the fatal throw
  is gone, and bundling soft-retries when the list appears late
  (`src/content.js`, `src/util/CoalescedRetry.js`).

[2.1.1]: https://github.com/benoror/inbundly/releases/tag/v2.1.1

## [2.1.0] - 2026-07-27

### Added
- **Custom bundles** — select any messages in Gmail and click the floating
  "Bundle selected" button to group them on the fly, with no Gmail label required.
  Custom bundles override label-based grouping, are kept even when they hold a single
  message, stick across reloads, and sync to your other signed-in Chrome browsers.
  Selecting messages already in a bundle turns the button into "Remove from bundle".
  Manage (rename/delete) them under Options → Custom bundles.
  - Keyed by Gmail's stable `data-legacy-thread-id` and persisted in
    `chrome.storage.sync` (`containers/CustomBundles.js`); the bundle key is the user's
    name prefixed with `0x1E` so it flows through the label-keyed pipeline without
    colliding with a real label or a combined-label (`0x1F`) key.

[2.1.0]: https://github.com/benoror/inboxy/releases/tag/v2.1.0

## [2.0.0] - 2026-07-27

First feature release of the fork. Forked from upstream v1.6.5 and brings Gmail bundling
closer to the original Google Inbox experience, plus the tooling and tests to maintain it.

### Added
- **Label-color bundles** — tint each bundle to match its Gmail label color, in one of
  two styles: a subtle, theme-aware background fill, or an accent bar + text only. The
  color runs the full height of open bundles.
- **Opt-in Stylus / Catppuccin color-matching** — snap bundle colors to a detected
  Catppuccin palette (`src/util/ThemePalette.js`).
- **Combine labels** — optionally bundle by the whole *set* of a thread's labels, so
  threads labeled `A + B` form their own bundle distinct from just `A`. Combined-bundle
  titles are compacted by factoring shared parent labels (`src/util/LabelSet.js`).
- **Priority bundles** — force chosen labels (or label sets) to always bundle together
  regardless of a thread's other labels. Join with `+` to require several; add a trailing
  `/*` to include a label's whole sub-label subtree; first matching rule wins.
- **`/*` subtree wildcard in the include/exclude label list** — the same multi-level,
  parent-inclusive wildcard now works in the "Only bundle…/Bundle all except…" list,
  reusing `matchLabelPattern`.
- **Skip single-item bundles** option (on by default) — labels with a single thread show
  as regular messages.
- Options to **hide the pinned-messages toggle** and the **bundle archive-all button**.
- `npm run watch` webpack script, a `CLAUDE.md` project guide, and new Jest suites
  (`ThemePalette`, `LabelSet`, `SelectiveBundling`, `DomUtils`, `DateDivider`).

### Changed
- combine-labels and bundle-colors are enabled by default.
- Tightened vertical spacing of expanded bundles.
- Fork-aware README and Options → Help / Get-started copy.
- `package.json` and `dist/manifest.json` now share a single version (2.0.0), starting
  this fork's own release line.
- Jest ignores `.claude/` worktrees so nested worktrees don't pollute test runs.

### Fixed
- Crash when a message row has no date cell.
- Raw NUL byte in the combined-label separator.

[2.0.0]: https://github.com/benoror/inboxy/releases/tag/v2.0.0
