# Bundle actions

Each bundle row carries a select-all checkbox and, on hover, action icons that act on the
whole bundle through Gmail's own toolbar: archive-all, snooze-all, and (when enabled)
delete-all. The checkbox selects or deselects every message in the bundle and mirrors a
partial selection as indeterminate. When a message outside the bundle is selected, the
bundle's actions are disabled so a bulk action can never widen the user's selection.
Which icons show is controlled by the `showBundleArchive`, `showBundleSnooze`, and
`showBundleDelete` options, applied live.

## Sub-features

- `actions-select-all` the bundle checkbox (`Select all messages in this bundle`) selects
  every member; Gmail's toolbar cluster appears; the bundle row takes Gmail's selected
  styling.
- `actions-deselect-all` clicking it again clears the selection.
- `actions-indeterminate` selecting one member by its own checkbox sets the bundle
  checkbox to `aria-checked="mixed"`.
- `actions-archive` hover, click the archive icon: members get selected and Gmail's
  toolbar Archive (`act="7"`) is clicked.
- `actions-snooze` hover, click the snooze icon: members get selected and Gmail's toolbar
  Snooze is clicked (Gmail's own menu then picks the time).
- `actions-delete` with `showBundleDelete` on, hover, click the delete icon: members get
  selected and Gmail's toolbar Delete (`act="10"`) is clicked.
- `actions-disable-outside` with a non-member selected, all three icons carry `disabled`
  and a click never reaches the toolbar.
- `actions-toggle-visibility` `showBundleDelete` is off by default (`<html>` has
  `hide-bundle-delete`); flipping it in sync storage shows or hides the icon live, and the
  same holds for `showBundleSnooze` and `showBundleArchive`.

## How to get to it (user POV)

- In the Inbox, hover a bundle row: the archive and snooze icons appear at the right; the
  delete icon appears too once enabled in Options.
- Click the checkbox at the left of a bundle row to select all its messages, then use
  Gmail's toolbar as usual.
- Options, then `Show the delete-all button on bundles` (and the archive and snooze
  switches above it) control which icons exist.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Work 1` and `Work 2` (label `Work`) and `Outside message` (no
  label). This is the `bundle-actions` seed in `scripts/drive.js` and the thread list of
  `e2e/bundle-actions.spec.js`.
- `const work = page.locator('.bundle-row', { hasText: 'Work' })` and
  `const checkbox = work.getByRole('checkbox', { name: 'Select all messages in this bundle' })`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive bundle-actions`.
  Ten walk steps `PASS` and `e2e/bundle-actions.spec.js` reports `8 passed`;
  `evidence/<RUN_ID>/bundle-actions/RESULT` reads `PASS`.
- **Select all.** `await checkbox.click()`. `tr.zA.x7:not(.bundle-row)` count is `2`,
  `page.locator('.G-Ni')` is visible, `checkbox` has `aria-checked="true"`, and `work` has
  class `x7`.
- **Deselect all.** `await checkbox.click()` again. `tr.zA.x7` count is `0` and
  `aria-checked="false"`.
- **Partial selection.** Toggle the `Work 1` row's own checkbox the synthetic way
  (`page.evaluate`: find the `tr.zA` containing the text, `.querySelector('.oZ-jc').click()`).
  `checkbox` has `aria-checked="mixed"`.
- **Archive all.** Clear the partial selection (toggle `Work 1` again), then
  `await work.hover()` and `await work.locator('.archive-bundle').click()`.
  `tr.zA.x7:not(.bundle-row)` count is `2`, `.G-Ni` is visible, and, polled (`expect.poll`
  or the walk's `eventually`), `page.evaluate(() => window.__gmail.clicks)` contains `act:7`.
- **Clear between actions.** `await checkbox.click()` (all members selected, so this
  deselects them). `tr.zA.x7` count is `0` and `.G-Ni` is hidden again.
- **Snooze all.** Hover, `await work.locator('.snooze-bundle').click()`. Two rows selected
  and `window.__gmail.clicks` contains `Snooze`. Clear again with the bundle checkbox.
- **Enable delete live.** `await setSyncOptions(context, { showBundleDelete: true })`.
  `page.locator('html')` loses class `hide-bundle-delete` without a reload.
- **Delete all.** Hover, `await work.locator('.delete-bundle').click()`. Two rows selected
  and `window.__gmail.clicks` contains `Delete`. Clear again with the bundle checkbox.
- **Outside selection disables.** Reset `window.__gmail.clicks` to `[]`, toggle the
  `Outside message` row checkbox (synthetic), then hover and click `.snooze-bundle`.
  `.snooze-bundle`, `.archive-bundle`, and `.delete-bundle` each have class `disabled`;
  `window.__gmail.clicks` stays `[]`.
- **Restore.** Toggle `Outside message` off and
  `await setSyncOptions(context, { showBundleDelete: false })`; `<html>` has
  `hide-bundle-delete` again.
- **Proof.** `evidence/<RUN_ID>/bundle-actions/02-select-all-via-bundle-checkbox-inbox.png`
  shows both rows selected with the toolbar cluster revealed; `05-archive-all-inbox.aria.txt`
  and `walk.md` carry the recorded toolbar clicks.

## Gotchas

- Action icons are `display: none` until the bundle row is hovered. A bare
  `locator.click()` on `.archive-bundle` times out waiting for visibility; hover the row
  first. The specs use `dispatchEvent('click')` instead, which also works.
- Toolbar clicks land asynchronously (the extension waits for Gmail's toolbar to reveal
  itself after selecting). Poll `window.__gmail.clicks`; a synchronous read right after the
  click returns `[]` and looks like a failure.
- A bulk action only fires once Gmail's toolbar cluster is revealed by the selection
  (the extension waits for that mutation). If a scenario leaves `.G-Ni` visible with
  nothing selected, the next action never fires; clear the selection with the bundle
  checkbox between actions and confirm `.G-Ni` is hidden before the next one. The fixture
  counts only message rows (`tr.zA.x7:not(.bundle-row)`) as selected for exactly this
  reason; do not loosen that selector.
- Never toggle a native row checkbox with a real click here: the extension's quick-select
  handler re-dispatches it and the row double-toggles.
- `showBundleDelete` is off by default on purpose (destructive); a walk that enables it
  must turn it back off before finishing, or the next scenario in the same profile starts
  from the wrong default.
- What Gmail does after the toolbar click (archive, the snooze menu, moving to Trash) is
  not emulated by the fixture; `TESTING.md` 5.4 and 5.8 stay manual.
