# Options page layout and find a setting

The Options tab is laid out as eight sections a user can name (Bundling, Labels, Inbox
layout, Pinned messages, Bundle actions, Appearance, Custom bundles, Sync & backup), each
with a one-line lead and one row per setting: name and explanation on the left, the switch
on the right. Jump links at the top reach every section, every switch row states its
default and is marked when its value differs, the less common settings fold under an
Advanced disclosure inside their section, and a search box narrows the page to matching
settings.

## Sub-features

- `layout-sections` the page opens on the Options tab, titled `Inbundly - Options`, with
  the eight `.option-category` sections in the order of the `.section-nav` links.
- `layout-jump` a jump link (or a direct `#<section-id>` URL) stays on the Options tab
  and scrolls that section to the top of the view.
- `layout-bundle-actions` the archive-all, snooze, and delete-all switches and the three
  archive switches (skip starred, mark read, unstar) share the `Bundle actions` section.
- `layout-defaults` every switch row carries `Default: on` or `Default: off`; a row whose
  value differs from its default gets the `differs` class, cleared when it is flipped back.
- `layout-fold` an Advanced fold (`#label-rules`, `#theme-matching`) is closed in a fresh
  profile and opens on load when a setting inside it differs from its default.
- `search-narrow` typing in `#options-search` hides the rows that do not match (a
  section's or subsection's name matches all of it), folds away sections left empty, dims
  their jump links, and opens a fold that holds a match.
- `search-empty` a query with no match shows `#options-no-matches` with the query quoted.
- `search-clear` Escape empties the box, brings every section back, and returns folds to
  how they were; `/` from the page focuses the box.

## How to get to it (user POV)

- Click the Inbundly toolbar icon, then `Options`; or `chrome://extensions`, Inbundly,
  `Extension options`. The Get started tab links into sections too (`Options -> Bundle
  actions`, `Options -> Pinned messages`, and so on).
- Click a chip under the search box to jump to that section; type in `Find a setting`
  (or press `/`) to narrow the page.
- Open `Advanced label rules` under Labels or `Theme matching` under Appearance for the
  folded settings.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Work 1` and `Work 2` (label `Work`). This is the
  `options-layout` seed in `scripts/drive.js`. The Gmail tab only needs to load once so
  the extension's service worker is up; the walk closes it again.
- Fresh profile, so `chrome.storage.sync.get(null)` (through `context.serviceWorkers()[0]`)
  returns `{}` and every fold is closed.
- `const deleteRow = options.locator('.option-row', { has: options.locator('#show-bundle-delete-checkbox') })`
  and `const search = options.locator('#options-search')`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive options-layout`.
  Seven walk steps `PASS`, `e2e/options-page.spec.js` reports `5 passed`, and
  `npx jest test/OptionsPage.test.js` passes; `evidence/<RUN_ID>/options-layout/RESULT`
  reads `PASS`.
- **Open.** `await options.goto(optionsUrl)`. `options.title()` is `Inbundly - Options`;
  `.option-category:not(.search-hidden)` ids are `bundling, labels, inbox-layout,
  pinned-messages, bundle-actions, appearance, custom-bundles, sync-backup`, the same as
  the `.section-nav a` hrefs; `.option-row .option-default` counts `17`; `deleteRow`'s
  chip reads `Default: off`; no `.differs` on the page; `#label-rules` has `open` false.
- **Jump.** `await options.locator('.section-nav a[href="#bundle-actions"]').click()`.
  `location.hash` is `#bundle-actions`, `.tab.options` is visible, and
  `#bundle-actions` has `getBoundingClientRect().top` between `0` and `120`. Its
  checkboxes are, in order, `show-bundle-archive-checkbox`, `show-bundle-snooze-checkbox`,
  `show-bundle-delete-checkbox`, `skip-starred-on-archive-checkbox`,
  `mark-read-on-archive-checkbox`, `unstar-on-archive-checkbox`.
- **Flip delete-all on.** `await deleteRow.locator('label.switch .slider').click()`.
  `#save-status` gains `visible`, `deleteRow` gains `differs`, sync storage equals
  `{ showBundleDelete: true }`.
- **Search.** `await search.fill('priority')`. Only `labels` remains among the visible
  sections, `#label-rules` is open, `#priority-bundles-list` is visible,
  `#combine-labels-checkbox` is hidden, `.section-nav a[href="#appearance"]` has `dimmed`.
- **No match.** `await search.fill('no such setting anywhere')`. No section is visible and
  `#options-no-matches` is, quoting the query.
- **Clear.** `await search.press('Escape')`. The box is empty, all eight sections are back,
  `#label-rules` is closed again, `#options-no-matches` is hidden.
- **Restore.** Click the delete-all slider again: `differs` gone, sync storage
  `{ showBundleDelete: false }`.
- **Proof.** `evidence/<RUN_ID>/options-layout/01-open-options-options.png` shows the
  sectioned page with its jump links; `04-search-priority-options.png` the page narrowed
  to the priority rules with the fold open; `walk.md` records the section ids, storage
  contents, and fold state after each step.

## Gotchas

- The real `<input type="checkbox">` is visually hidden behind the styled `.slider`; click
  the slider inside the same `label.switch`, never `check()` on the input.
- The search matches the visible copy, so a word that appears in another setting's
  explanation finds that row too (`snooze` also finds the `Snoozed` view in "Also bundle
  outside the inbox"); pick a distinctive word such as `priority` or `delete-all`.
- A fold also opens on load when a setting inside it differs from its default (a stored
  `priorityBundles` list, `combineLabels` off). Start from an empty store when a step
  expects `#label-rules` closed.
- Every visit to the Options tab re-reads the form from storage; a flip made through
  `setSyncOptions` shows after `options.reload()` or on the tab's storage listener, not
  synchronously.
- `/` only focuses the search box while the Options tab is showing and focus is not in an
  input or textarea.
