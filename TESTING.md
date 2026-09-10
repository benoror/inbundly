# Inbundly testing matrix

This file is the codified test plan for Inbundly. It lists every user-facing
feature, its scenarios, and where each scenario is covered. New features must
add rows here. New Playwright specs and unit tests spin off these rows.

Coverage keys:

- **unit** — Jest (`test/*.test.js`, jsdom). Run: `npm test`.
- **e2e** — Playwright against the built extension and a Gmail-shaped fixture
  page (`e2e/`). Run: `npm run test:e2e`.
- **manual** — needs real Gmail. Follow the protocol at the bottom.

Feature history sources: `CHANGELOG.md`, merged PRs (#25, #27/#29, #31, #32),
tags `v2.1.0` … `v4.2.0` + unreleased.

## 1. Core bundling

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 1.1 | 2+ threads with the same label form one bundle row (title, count, senders preview, latest date) | happy | e2e `bundling.spec` · unit `BundlerOptions` |
| 1.2 | Click a bundle row → messages expand in place; click again → collapse | happy | e2e `bundling.spec` |
| 1.3 | Click outside any row → open bundle closes | edge | e2e `remember-open-bundle.spec` |
| 1.4 | Only one bundle open at a time | edge | unit `BundledMail` |
| 1.5 | Unlabeled/unbundled messages stay plain rows | happy | e2e `bundling.spec` |
| 1.6 | 25+ threads in one bundle show count "25+" | edge | manual |
| 1.7 | Bundles are keyed per page → tab → section; same label bundles independently per section | edge | unit `BundledMail` |
| 1.8 | Multi-section inbox types (Priority, Multiple Inboxes, Important first) bundle every visible section; no date dividers there | edge | unit (`getSectionMessageLists`) · manual |
| 1.9 | Rows Gmail streams into an already-bundled table trigger a rebundle (no half-bundled list) | edge | unit `BundlerOptions` (`_hasUnprocessedRows`) |
| 1.10 | Gmail leaves label chip `title` empty → label read from descendants/aria-label | edge | unit `DomUtils` |
| 1.11 | Message row without a date cell does not crash bundling | edge | unit `DateDivider` |

## 2. Label selection rules

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 2.1 | Exclude list: listed labels stay unbundled, everything else bundles | happy | unit `SelectiveBundling` |
| 2.2 | Include list: only listed labels bundle | happy | unit `SelectiveBundling` |
| 2.3 | `/*` wildcard matches the label and its whole subtree, case-insensitive | happy | unit `SelectiveBundling` |
| 2.4 | Plain entry matches exactly, not the subtree; no sibling-prefix match | edge | unit `SelectiveBundling` |
| 2.5 | Combine labels ON: each distinct label *set* forms its own bundle; title factors shared parents | happy | e2e `bundling.spec` · unit `LabelSet` |
| 2.6 | Priority rules: first match wins; `+` requires all; `/*` folds subtree; overrides set-grouping and include/exclude | happy | unit `SelectiveBundling`, `LabelSet` |
| 2.7 | Single-item bundles skipped (label with 1 thread renders as a plain row) when option on | happy | e2e `bundling.spec` · unit `BundlerOptions` |

## 3. Sender bundles (unreleased, PR #32)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 3.1 | 2+ unlabeled threads from one domain bundle; title = domain | happy | e2e `sender-bundles.spec` · unit `SelectiveBundling` |
| 3.2 | Freemail senders (gmail.com, outlook.com, …) group by exact address, not domain | happy | e2e `sender-bundles.spec` · unit `SenderBundleKey` |
| 3.3 | A labeled thread never sender-bundles (labels/priority/custom win) | happy | e2e `sender-bundles.spec` · unit `SelectiveBundling` |
| 3.4 | 1 thread from a sender stays a plain row, even with `skipSingleItemBundles` off | edge | e2e `sender-bundles.spec` · unit `BundlerOptions` |
| 3.5 | "View all" searches `from:(@domain)` / `from:(address)` | happy | e2e `sender-bundles.spec` |
| 3.6 | Thread with no `span[email]` (e.g. drafts) stays loose | edge | unit `SelectiveBundling` |
| 3.7 | Option `senderBundling` off → no sender bundles | happy | unit `SelectiveBundling` |
| 3.8 | Sender bundles render uncolored; key prefix `0x1D` never collides with labels/custom/combined keys | edge | unit `SenderBundleKey` |
| 3.9 | Different domains never merge (e.g. `bee-link.com` vs `shop-convert.com`) — verified live 2026-09-09 | edge | manual ✔ |
| 3.10 | Known limitation: subdomains split bundles (`e.crm.lego.com` ≠ `lego.com`). Revisit with eTLD+1 if annoying | note | — |

## 4. Remember the open bundle (unreleased, PR #32)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 4.1 | Open bundle → reload the tab → same bundle reopens | happy | e2e `remember-open-bundle.spec` · manual ✔ |
| 4.2 | Collapse → reload → stays closed (store cleared) | happy | e2e `remember-open-bundle.spec` · manual ✔ |
| 4.3 | Close via outside click / bundle-area click → store cleared | happy | e2e `remember-open-bundle.spec` |
| 4.4 | Memory is per page + tab; a same-named bundle on another page must not reopen | edge | unit `OpenBundleStore` |
| 4.5 | Remembered bundle no longer exists (archived away) → no reopen, no crash | edge | unit `BundlerOptions` |
| 4.6 | Corrupt/unavailable sessionStorage → silent no-op | edge | unit `OpenBundleStore` |
| 4.7 | Option `rememberOpenBundle` off → no restore | happy | unit `BundlerOptions` |
| 4.8 | StarHandler's internal `openBundle` (scroll anchoring) must not write the store | edge | unit (by design: writes live only in `BundleToggler`) |

## 5. Bundle actions (archive, snooze, select)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 5.1 | Bundle select-all checkbox selects/deselects every message; Gmail toolbar appears | happy | e2e `bundle-actions.spec` · unit `BundleCheckbox` |
| 5.2 | Partial selection shows the indeterminate icon (`aria-checked=mixed`) | edge | e2e `bundle-actions.spec` |
| 5.3 | Archive-all: selects the bundle's rows, then clicks Gmail's toolbar archive (`act="7"`) | happy | e2e `bundle-actions.spec` · unit `GmailToolbar` |
| 5.4 | Snooze bundle: selects rows, clicks Gmail's toolbar snooze; Gmail's own menu picks the time | happy | e2e `bundle-actions.spec` · unit `BundleSnoozeButton` · manual ✔ (menu + "2 conversations snoozed", 2026-09-09) |
| 5.5 | Snooze/archive disabled when a message outside the bundle is selected | edge | e2e `bundle-actions.spec` · manual ✔ |
| 5.6 | Toolbar button missing (Gmail markup change) → click is a silent no-op, no throw | edge | unit `GmailToolbar` |
| 5.7 | Toolbar snooze selector (`data-tooltip="Snooze"` / `aria-label`) matches real Gmail — verified live 2026-09-09 | contract | manual ✔ + e2e fixture mirrors it |
| 5.8 | Date-section archive-all still works (shares `GmailToolbar`) | happy | manual |
| 5.9 | `showBundleArchive` / `showBundleSnooze` off → buttons hidden via `<html>` class | happy | e2e `bundle-actions.spec` (live storage flip) · unit `Options` |

## 6. Pinning / starred

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 6.1 | `keepStarredUnbundled` on (default): starred thread stays outside its bundle | happy | unit `BundlerOptions`, `StarHandler` · manual ✔ (2026-09, prior session) |
| 6.2 | Starring inside an open bundle pops the message out; unstarring returns it | happy | manual ✔ (prior session) |
| 6.3 | Option off: starred messages bundle normally; no scroll compensation | edge | unit `StarHandler` |
| 6.4 | Pinned-messages toggle in search bar (hidden by default) filters to starred | happy | manual |

## 7. Dates & sections

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 7.1 | Date dividers group the single-section inbox (Today / This month / …) | happy | e2e `bundling.spec` |
| 7.2 | `groupMessagesByDate` off → no dividers | happy | unit |
| 7.3 | Snoozed rows show snoozed text in the bundle date; snoozed rows force a Today divider | edge | unit `DateDivider`, `BundleRow` |
| 7.4 | Starred search page gets date dividers via `DateGrouper` | happy | manual |

## 8. Appearance

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 8.1 | Bundle colors match Gmail label colors (fill or accent style), light + dark themes | happy | unit `ThemePalette` · manual |
| 8.2 | Combined bundles color by first label; neutral colors get boosted contrast | edge | unit `ThemePalette` |
| 8.3 | Stylus/Catppuccin matching snaps colors to the detected flavor (opt-in) | happy | unit `ThemePalette` · manual |
| 8.4 | Custom and sender bundles render uncolored | edge | e2e `sender-bundles.spec` |

## 9. Custom bundles

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 9.1 | Select loose messages → "Bundle selected" → named custom bundle forms | happy | manual |
| 9.2 | Custom key (0x1E) wins over priority rules and labels; survives at 1 message | edge | unit `SelectiveBundling`, `CustomBundles`, `BundlerOptions` |
| 9.3 | Rename/delete from Options; membership syncs across devices | happy | unit `CustomBundles`, `OptionsPage` · manual |
| 9.4 | Custom bundles have no "View all" link (no searchable label) | edge | unit — see `BundleRow` |

## 10. Master switch, options, sync

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 10.1 | `bundlingEnabled` off → plain Gmail list, injected controls hidden; first paint never briefly bundles | happy | unit · manual |
| 10.2 | Toggle from any of: search-bar switch, Options, popup — all three sync | happy | manual |
| 10.3 | Options auto-save per key; untouched keys follow future defaults | happy | unit `OptionsPage` |
| 10.4 | Option changes sync live (other device / other tab) and rebundle | happy | e2e `bundle-actions.spec` (storage flip) · unit |
| 10.5 | JSON export/import round-trip; unknown keys dropped | edge | unit `OptionsPage` |
| 10.6 | Extension ID pinned via manifest `key` (sync depends on it) | contract | unit `ExtensionId` |
| 10.7 | Options page UI itself | happy | unit `OptionsPage` (jsdom) · manual only — Chrome blocks automation on `chrome-extension://` pages |

## 11. Robustness

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 11.1 | Options never race the first bundle pass (`optionsReady` gates) | edge | unit `BundlerOptions` |
| 11.2 | Message list not painted yet → `CoalescedRetry` soft-retries; never a fatal skip of observers | edge | unit `CoalescedRetry` |
| 11.3 | Open bundle holds its position (frozen order) across rerenders | edge | unit `BundledMail` |
| 11.4 | Theme detection does not crash in popout windows | edge | unit `ThemePalette` |

## How the e2e suite works

Playwright loads the **built extension** (`dist/`, so run `npm run build`
first) into Chromium via `launchPersistentContext`, then intercepts
`https://mail.google.com/**` and fulfills it with a **Gmail-shaped fixture
page** (`e2e/fixture/inbox.js`). The content script injects for real — same
manifest, same selectors, same storage — everything except Google's servers.

The fixture builds its DOM strictly from the selector contract in
`src/util/Constants.js` (rows `tr.zA`, checkbox `.oZ-jc` in `td.oZ-x3`,
senders `.yX.xY .yW .bA4 span[email]`, labels `.ar.as .at`, list
`[role=main] .ae4 .Cp > div > table.F > tbody`, toolbar
`.G-atb > .G-Ni[display:none] > [act="7"] / [data-tooltip="Snooze"]`),
verified against live Gmail on 2026-09-09. It also emulates the Gmail
behaviors the extension depends on: clicking a row checkbox toggles
`aria-checked` and the row's `x7` class, and reveals the toolbar's action
cluster; toolbar clicks are recorded on `window.__gmail.clicks`.

**When Gmail changes markup**: update `src/util/Constants.js` AND the fixture
together — the fixture is the executable record of what we believe Gmail's
DOM looks like.

## Manual QA protocol (real Gmail, browser-use)

1. Build (`npm run build`), reload the unpacked extension, refresh Gmail.
2. Prefer read-only checks (open/close bundles, reloads, tab switches,
   DOM/sessionStorage inspection).
3. Mutating checks must be reversed before finishing:
   - Snooze test → unsnooze from `#snoozed` (select → clock menu → Unsnooze).
   - Archive test → move back to Inbox from All Mail.
   - Star test → unstar. Selection test → deselect.
   - Label/custom-bundle changes → restore the previous labels/membership.
4. Chrome blocks automation on `chrome://` and `chrome-extension://` pages:
   extension reload and the Options page need a human (options logic is
   covered by `OptionsPage.test.js` in jsdom).
5. Snooze-selector canary: in DevTools on Gmail, confirm
   `document.querySelector('.T-I.J-J5-Ji[data-tooltip="Snooze"]')` is not
   null. If it is, Gmail changed — update `TOOLBAR_SNOOZE_BUTTON`.

Last full manual pass: **2026-09-09** (PR #32 features; all pass — snooze
menu end-to-end with restore, remember-open-bundle across reloads, sender
bundles on the Promotions tab, disable-on-outside-selection).
