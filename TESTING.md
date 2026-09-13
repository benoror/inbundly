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
tags `v2.1.0` … `v4.4.0`.

## 1. Core bundling

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 1.1 | 2+ threads with the same label form one bundle row (title, count, senders preview, newest thread's sender and date; see section 14) | happy | e2e `bundling.spec` · unit `BundlerOptions` |
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

## 5. Bundle actions (archive, snooze, select, delete)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 5.1 | Bundle select-all checkbox selects/deselects every message; Gmail toolbar appears | happy | e2e `bundle-actions.spec` · unit `BundleCheckbox` |
| 5.2 | Partial selection shows the indeterminate icon (`aria-checked=mixed`) | edge | e2e `bundle-actions.spec` |
| 5.3 | Archive-all: selects the bundle's rows, then clicks Gmail's toolbar archive (`act="7"`) | happy | e2e `bundle-actions.spec` · unit `GmailToolbar` |
| 5.4 | Snooze bundle: selects rows, clicks Gmail's toolbar snooze; Gmail's own menu picks the time | happy | e2e `bundle-actions.spec` · unit `BundleSnoozeButton` · manual ✔ (menu + "2 conversations snoozed", 2026-09-09) |
| 5.5 | Snooze/archive/delete disabled when a message outside the bundle is selected | edge | e2e `bundle-actions.spec` · manual ✔ |
| 5.6 | Toolbar button missing (Gmail markup change) → click is a silent no-op, no throw | edge | unit `GmailToolbar` |
| 5.7 | Toolbar snooze selector (`data-tooltip="Snooze"` / `aria-label`) matches real Gmail — verified live 2026-09-09 | contract | manual ✔ + e2e fixture mirrors it |
| 5.8 | Date-section archive-all still works (shares `GmailToolbar`) | happy | manual |
| 5.9 | `showBundleArchive` / `showBundleSnooze` off → buttons hidden via `<html>` class | happy | e2e `bundle-actions.spec` (live storage flip) · unit `Options` |
| 5.10 | Delete-all: selects the bundle's rows, then clicks Gmail's toolbar delete (`act="10"`) | happy | e2e `bundle-actions.spec` · unit `BundleDeleteButton` |
| 5.11 | `showBundleDelete` off by default (destructive); on → button shown via live storage flip | happy | e2e `bundle-actions.spec` · unit `Options` |
| 5.12 | Toolbar delete selector (`act="10"` / `data-tooltip="Delete"` / `aria-label`) matches the fixture contract | contract | unit `BundleDeleteButton` · e2e fixture mirrors it |

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
| 10.7 | Options page UI itself | happy | unit `OptionsPage` (jsdom) · verify-inbundly `options-autosave` walk (Playwright Chromium loads and scripts `chrome-extension://…/options/options.html`; flips a real switch, reads `chrome.storage.sync` through the service worker, checks the Gmail tab reacts live) · manual for branded Chrome, where automation of `chrome-extension://` pages is blocked |

## 11. Robustness

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 11.1 | Options never race the first bundle pass (`optionsReady` gates) | edge | unit `BundlerOptions` |
| 11.2 | Message list not painted yet → `CoalescedRetry` soft-retries; never a fatal skip of observers | edge | unit `CoalescedRetry` |
| 11.3 | Open bundle holds its position (frozen order) across rerenders | edge | unit `BundledMail` |
| 11.4 | Theme detection does not crash in popout windows | edge | unit `ThemePalette` |

## 12. Keyboard navigation (unreleased, PR #62, issue #46)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 12.1 | `j` / `k` (and arrows once focus is in the list) step through visible rows in display order: plain threads, bundle rows, the open bundle's threads; ends of the list stop | happy | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler` |
| 12.2 | Gmail's cursor mark (`btb`) never lands on a thread hidden in a collapsed bundle; a cursor stranded on one resumes from its bundle row | edge | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler` |
| 12.3 | `Enter` / `o` on a bundle row opens it; opening (keyboard or mouse) moves Gmail's cursor onto the first revealed thread, so `e` archives that thread (inboxy#50) | happy | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler`, `GmailCursor` |
| 12.4 | `Escape` inside the open bundle collapses it, lands on the bundle row, forgets the remembered bundle (user close) | happy | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler` |
| 12.5 | Bundle-row shortcuts mirror the row's buttons: `x` select-all, `e`/`y` archive-all, `b` snooze, `#` delete-all; each only when shown (`show*` option) and enabled (no outside selection) | happy | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler` |
| 12.6 | Other thread shortcuts on a bundle row (`s`, `!`, `v`, `l`, `I`, `U`, `r`, `.`, ...) are swallowed; `c`, `/`, `g`, `z`, `?`, Tab pass through | edge | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler` |
| 12.7 | Text fields, dialogs, menus, and focusable controls (bundle checkbox, View all) keep their keys; modifiers and untrusted (synthetic) keys pass through; inactive when bundling is off or off the inbox | edge | e2e `keyboard-nav.spec` · unit `KeyboardNavHandler` |
| 12.8 | Fallback when Gmail's cursor does not follow focus and nothing is checked: `e`/`#`/`b` go through Gmail's toolbar for the visible row, `x` clicks its checkbox, `Enter`/`o` click the row; an existing selection is left to Gmail | edge | e2e `keyboard-nav.spec` (`cursorFollowsFocus: false`) · unit `KeyboardNavHandler` |
| 12.9 | Gmail cursor model canary: in live Gmail with shortcuts on, press `j`, then in DevTools confirm `document.activeElement` is the `tr.zA.btb` row and `document.activeElement.tabIndex === -1`; then run `[...document.querySelectorAll('tr.zA')][3].focus()` and confirm `btb` moved to that row. If either fails, Gmail changed the model `GmailCursor` relies on (the 12.8 fallbacks still cover `e`/`x`/`#`/`b`/`Enter`) | contract | manual |
| 12.10 | Known limitations: a bundle row loses the cursor when Gmail rerenders the list (next `j` resumes from Gmail's mark or the top); `j`/`k` are handled even when Gmail's own shortcuts are turned off; the 12.8 `Enter` fallback is a best-effort row click; no shortcut parity beyond the keys above (Simplify-style shortcuts are out of scope) | note | — |

## 13. Bundles outside the Inbox (unreleased, PR #63, issue #43)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 13.1 | `bundleOtherViews` off (default): search results, label views, Snoozed stay plain Gmail lists; the Inbox bundles regardless | happy | e2e `other-views.spec` · unit `MessagePageUtils`, `Options` |
| 13.2 | Flipping the option live (Options switch or sync) rebundles the view the user is on; flipping it off refreshes back to a plain list | happy | e2e `other-views.spec` (storage flip + fixture Refresh emulation) |
| 13.3 | With the option on, a search bundles by label and by sender like the Inbox; Gmail's built-in chips (Inbox, Sent, Draft, Spam, Trash, ...) are never bundle keys | happy | e2e `other-views.spec` · unit `SelectiveBundling` |
| 13.4 | The label a view is filtered by is not a bundle key there: `#label/Work`, the `label:` terms of a search (a bundle's own "View all"), and the `from:` sender of a search; threads group by their other labels or by sender instead | edge | e2e `other-views.spec` · unit `SelectiveBundling`, `MessagePageUtils` (`getViewFilters`) |
| 13.5 | Snoozed, Starred, Important, All Mail, category views, and Multiple Inboxes `section_query` searches are bundlable; "View all" is scoped to the view (`in:snoozed`, the search's query, `label:<name>`, `is:starred`, `is:important`, none for All Mail) | happy | e2e `other-views.spec` (Snoozed) · unit `MessagePageUtils` (`getViewSearchScope`) · manual for the rest |
| 13.6 | The pinned page (`#search/is:starred label:inbox`) keeps its flat, date-grouped list even with the option on | edge | e2e `other-views.spec` · unit `MessagePageUtils` |
| 13.7 | Conversations in any view, Sent, Drafts, Spam, Trash, settings, contacts, advanced search never bundle | edge | e2e `other-views.spec` · unit `MessagePageUtils` |
| 13.8 | Bundles and the remembered open bundle are kept per view (then page and tab): a Work bundle in the Inbox and one in a search never share state; pre-view sessionStorage records are ignored | edge | unit `BundledMail`, `OpenBundleStore` |
| 13.9 | Paging in other views (`#search/q/p2`, `#label/Work/p2`, `#snoozed/p2`) is recognized like `#inbox/p2` | edge | unit `MessagePageUtils` |
| 13.10 | Live Gmail contract: search results, label views, and Snoozed render the same `[role=main] .ae4 .Cp table.F tbody tr.zA` list as the Inbox; the pinned page already relied on this for `DateGrouper`, the rest is to be confirmed in live Gmail (open a search with the option on and check `document.querySelectorAll('.bundle-row').length`) | contract | manual |
| 13.11 | Known limitations: the pinned toggle shows only on the Inbox and pinned page; Gmail's built-in label names are matched in English; `label:(A OR B)` searches drop only `A`; in a label view the threads that have no other label group by sender (2+ threads), which is by design; search results mixing Sent threads sender-bundle by recipient domain (Gmail lists the recipient where the sender goes); date dividers follow `groupMessagesByDate` in single-list views, so a search with mixed ages gets Today / Earlier headings | note | - |

## 14. Collapsed-row glance (unreleased, PR #64, issue #56)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 14.1 | A closed bundle row shows its newest thread's most recent sender right before that thread's date (`.bundle-latest-sender`, then `.bundle-date`), reading like a Gmail thread row; the senders peek next to the title still lists everyone, most recent first | happy | e2e `collapsed-glance.spec`, `bundling.spec` · unit `MessageGlance` |
| 14.2 | Newest thread unread: sender and date bold (like Gmail's unread rows); read: the sender sits in a muted weight and the date in the row's normal weight | happy | e2e `collapsed-glance.spec` · unit `MessageGlance` |
| 14.3 | Tooltips: the sender's `title` is the address; the date's `title` is Gmail's full-date tooltip carried over from the thread's `.xW span[title]` | happy | e2e `collapsed-glance.spec` · unit `MessageGlance` |
| 14.4 | Newest thread snoozed: its snoozed-until text stands in for the date, as before (7.3); newest thread exposes no sender span (drafts): date only, no crash; row without a date cell: empty date, no throw | edge | unit `MessageGlance` |
| 14.5 | The glance is part of the date cell, so it hides while the bundle is open (`View all` takes its place) and returns on collapse; colored bundles paint it in the label's accent | happy | e2e `collapsed-glance.spec` · manual (colors) |
| 14.6 | The sender's display text is whatever Gmail shows (`me`, a name, or an address); a long name truncates with an ellipsis at 160px; the vertical-split reading pane (`.Zs`) hides the sender and keeps the date alone | edge | manual |
| 14.7 | Newest thread is the bundle's first row in Gmail's list order (Gmail sorts every bundlable view newest first; Snoozed sorts by snooze time, so there the glance is the soonest-due thread) | contract | manual |

## 15. Archive-all and date sweep switches (unreleased, PR #65, issues #40 and #48)

| # | Scenario | Kind | Coverage |
|---|----------|------|----------|
| 15.1 | All three switches off (default): archive-all and the date sweep select every thread they always did, pinned included, and click Gmail's Archive and nothing else; flipping a switch asks Gmail for no refresh and rebundles nothing (read at click time) | happy | e2e `bulk-trust.spec` · unit `ArchiveAction`, `Options`, `OptionsPage` |
| 15.2 | `skipStarredOnArchive` on: the date sweep leaves starred (pinned) threads unselected and in place; archive-all does the same for a pinned thread inside its bundle (`keepStarredUnbundled` off); a pinned thread the user checked by hand is deselected first so it never rides along | happy | e2e `bulk-trust.spec` · unit `ArchiveAction`, `GmailToolbar` (`deselectMessages`) |
| 15.3 | `skipStarredOnArchive` on and every thread in the section starred: the icon is a no-op (no selection, Gmail untouched) | edge | unit `ArchiveAction` |
| 15.4 | `markReadOnArchive` on: Gmail's toolbar `Mark as read` is clicked on the selection before `Archive`; an all-read selection (or a toolbar without that button) goes straight to `Archive`; unread is judged on the threads being archived, not the skipped ones | happy | e2e `bulk-trust.spec` · unit `ArchiveAction`, `GmailToolbar` (`precededBy`) |
| 15.5 | `unstarOnArchive` on: the star is clicked off each starred thread being archived before the toolbar click; with skip-starred on too, a skipped pin keeps its star | happy | e2e `bulk-trust.spec` · unit `ArchiveAction` |
| 15.6 | `e` / `y` on a bundle row runs archive-all under the same switches (it clicks the row's icon); Gmail's own archive paths (row hover icon, toolbar on a manual selection, `e` on a thread, the keyboard fallback for a single row) are not changed | happy | e2e `bulk-trust.spec` · unit `KeyboardNavHandler` |
| 15.7 | Options page: the three switches under Features, Archive-all and date sweep, each auto-save their own key and restore from storage | happy | unit `OptionsPage` · verify-inbundly `bulk-trust` walk (real switch clicks) |
| 15.8 | Live Gmail contract: with unread threads selected, `document.querySelector('.G-atb:not([style*="none"]) .T-I.J-J5-Ji[data-tooltip="Mark as read"]')` is the envelope button and clicking it leaves the selection in place for the following Archive; clicking a row's `.T-KT.T-KT-Jp` unstars it. English-only tooltips, like snooze | contract | manual |
| 15.9 | Known limitations: `Mark as read` and unstar go through Gmail's own controls, so what Gmail does after (server-side read state, the thread leaving Starred, undo) is Gmail's; a section of only pinned threads makes the icon a silent no-op rather than a disabled one; the pin-icon affordance in place of the star (#40) is not part of this layer | note | - |

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
`.G-atb > .G-Ni[display:none] > [act="7"] / [act="10"] / [data-tooltip="Snooze"] /
[data-tooltip="Mark as read"]`), verified against live Gmail on 2026-09-09
(the envelope button's tooltip is the contract row 15.8 checks). It also
emulates the Gmail behaviors the extension depends on: clicking a row
checkbox toggles `aria-checked` and the row's `x7` class, and reveals the
toolbar's action cluster while any message row (`tr.zA.x7:not(.bundle-row)`,
since the extension mirrors a full selection onto its bundle row too) is
selected; toolbar clicks are recorded on `window.__gmail.clicks`, Archive
and Mark as read also on `window.__gmail.actions` with the selected rows'
subjects; Mark as read flips the selected rows to read and the envelope
reads "Mark as read" only while the selection holds an unread row; clicking
a row's star toggles it and records a star / unstar action. It also models
Gmail's keyboard cursor the way the extension understands it (row 12.9 is
the live canary): rows are focusable (`tabindex="-1"`), the cursor row
carries `btb` and follows DOM focus, `j`/`k` walk Gmail's DOM-ordered list
(hidden rows included), and `e`/`x`/`Enter`/`s` act on the checked rows or
the cursor row, logging to `window.__gmail.actions`.
`inboxPage({ cursorFollowsFocus: false })` builds a Gmail whose cursor
ignores focus, for the extension's fallback paths. The Refresh button
(`act="20"`) rebuilds the list from pristine rows, as Gmail's does, and counts
on `window.__gmail.refreshes`; the extension clicks it after an option
changes and rebundles from the repaint. The same fixture stands for every
list view: `openView(context, hash)` (`e2e/helpers/gmail.js`) opens it at
`#search/...`, `#label/...`, `#snoozed`, and so on, and the URL hash alone
decides which view the extension believes it is on, as in Gmail;
`inboxPage({ tab: null })` drops the category tablist Gmail shows only in the
Inbox.

**When Gmail changes markup**: update `src/util/Constants.js` AND the fixture
together — the fixture is the executable record of what we believe Gmail's
DOM looks like.

**Proof runs for agents**: `.cursor/skills/verify-inbundly/` wraps this
harness as a verification skill (`scripts/verify.sh launch | doctor | drive
<feature> | cleanup`). It walks one feature the way a user would, records
screenshots, ARIA snapshots, and checked values under
`.cursor/skills/verify-inbundly/evidence/<RUN_ID>/`, then runs the mapped
spec. The feature recipes live in `.cursor/skills/verify-inbundly/features/`.

## Manual QA protocol (real Gmail, browser-use)

1. Build (`npm run build`), reload the unpacked extension, refresh Gmail.
2. Prefer read-only checks (open/close bundles, reloads, tab switches,
   DOM/sessionStorage inspection).
3. Mutating checks must be reversed before finishing:
   - Snooze test → unsnooze from `#snoozed` (select → clock menu → Unsnooze).
   - Archive test → move back to Inbox from All Mail.
   - Delete/trash-all test → restore from Trash.
   - Star test → unstar. Selection test → deselect.
   - Label/custom-bundle changes → restore the previous labels/membership.
4. Branded Chrome blocks automation on `chrome://` and `chrome-extension://`
   pages: extension reload and the real-extension Options page need a human
   there (options logic is covered by `OptionsPage.test.js` in jsdom, and the
   Options UI by the verify-inbundly `options-autosave` walk in Playwright
   Chromium, row 10.7).
5. Snooze-selector canary: in DevTools on Gmail, confirm
   `document.querySelector('.T-I.J-J5-Ji[data-tooltip="Snooze"]')` is not
   null. If it is, Gmail changed — update `TOOLBAR_SNOOZE_BUTTON`.
6. Keyboard-cursor canary (row 12.9): with Gmail shortcuts on, press `j` and
   confirm `document.activeElement` is the `tr.zA.btb` row; focus another row
   with `.focus()` and confirm `btb` follows. Then, with a bundle open, put the
   cursor on one of its threads and press `e`: that thread (and only it) is
   archived. Move it back from All Mail afterwards.
7. Other-views canary (row 13.10): turn on Options, Bundling, "Also bundle
   outside the inbox"; run a search that returns labeled threads, open a
   label from the left nav, and open Snoozed. Each should show bundle rows
   (`document.querySelectorAll('.bundle-row').length > 0`) with no bundle
   titled `Inbox`, and "View all" on a bundle should keep you in that view.
   Turn the switch off afterwards; the lists refresh to plain.
8. Archive-switch canary (row 15.8): select one unread thread in the Inbox
   and confirm `document.querySelector('.G-atb:not([style*="none"]) .T-I.J-J5-Ji[data-tooltip="Mark as read"]')`
   is the envelope button. Then turn on Options, Features, "Mark messages as
   read when archiving" and "Leave starred messages in place", star one
   thread in a bundle of unread threads (with "Keep starred messages outside
   bundles" off so it stays inside), and click the bundle's archive-all: the
   unread threads are marked read and archived, the starred one stays.
   Move the archived threads back from All Mail and unstar afterwards.

Last full manual pass: **2026-09-09** (PR #32 features; all pass — snooze
menu end-to-end with restore, remember-open-bundle across reloads, sender
bundles on the Promotions tab, disable-on-outside-selection).
