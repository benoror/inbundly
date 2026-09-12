# Keyboard navigation

With bundling on, Gmail's `j` / `k` (and the arrow keys once focus is in the list) step
through the rows the user actually sees: plain threads, bundle rows, and the threads of the
open bundle, in display order. A collapsed bundle is one stop, never a detour through its
hidden threads. On a bundle row, `Enter` or `o` opens it (the cursor lands on its first
thread, so `e` archives that thread), `x` selects the whole bundle, `e` / `b` / `#` run the
row's archive-all / snooze / delete-all (when that button is shown and enabled), and the
other thread shortcuts do nothing. `Escape` from inside an open bundle collapses it and
lands on the bundle row. Opening a bundle with the mouse moves the cursor onto its first
thread too.

## Sub-features

- `nav-walk` `j` / `k` visit `Loose A`, the `Work` bundle row, `Loose B`, the `News` bundle
  row, and stop at the ends; the bundle row shows a cursor ring (`.inbundly-cursor`).
- `nav-no-hidden-stop` Gmail's own cursor mark (`tr.zA.btb`) never lands on a thread hidden
  in a collapsed bundle; on a bundle row it is cleared.
- `nav-enter-opens` `Enter` on a bundle row opens it; the cursor and Gmail's mark move to
  its first thread.
- `nav-archive-inside` `e` on that thread archives exactly that thread (Gmail's own
  shortcut, on the row the user sees).
- `nav-walk-inside` `j` continues through the open bundle's threads and out to the next
  visible row; `k` returns to the bundle row.
- `nav-escape` `Escape` inside the open bundle collapses it, lands on the bundle row, and
  forgets the remembered bundle like a click would.
- `nav-row-shortcuts` on a bundle row `e` archives the whole bundle through Gmail's toolbar
  (`act="7"`), `x` selects all of it, `s` (and other thread shortcuts) are inert.
- `nav-click-open` clicking a bundle row open puts the cursor on its first thread.
- `nav-typing` keys typed into a text field are left alone.

## How to get to it (user POV)

- In the Inbox, press `j` repeatedly: the cursor walks down the visible rows, bundle rows
  included. `k` walks back up.
- On a bundle row, press `Enter` (or `o`) to open it, `Escape` to close it from inside,
  `x` to select all its threads, `e` to archive the whole bundle.
- Inside an open bundle, press `e` to archive the thread the cursor is on.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads, in Gmail order: `Loose A`, `Work 1` (label `Work`), `Loose B`,
  `Work 2` (label `Work`), `News 1` and `News 2` (label `News`). Display order is `Loose A`,
  `[Work]`, `Loose B`, `[News]`. This is the `keyboard-nav` seed in `scripts/drive.js`
  and the thread list of `e2e/keyboard-nav.spec.js`.
- Read the cursor with `document.activeElement.closest('tr.zA')`: a message row's subject
  (`.y6 span span`) or a bundle row's label (`.bundle-and-count span`). Read Gmail's mark
  with `tr.zA.btb:not(.bundle-row)`. Thread actions land on `window.__gmail.actions` as
  `{ type, subjects }`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive keyboard-nav`.
  Eleven walk steps `PASS` and `e2e/keyboard-nav.spec.js` reports `11 passed`;
  `evidence/<RUN_ID>/keyboard-nav/RESULT` reads `PASS`.
- **Fresh load.** `const page = await openInbox(context)`. Focus is on `body`; no
  `tr.zA.btb`.
- **Walk down.** `await page.keyboard.press('j')` twice. Cursor is the `Work` bundle row,
  `.bundle-row.inbundly-cursor` has text `Work`, Gmail's mark is `null`. Two more `j`:
  cursor is `News` (the stop between was `Loose B`); `.bundled-message.visible` stays `0`.
- **Walk up.** `k`: cursor `Loose B`, Gmail's mark `Loose B`, `.inbundly-cursor` count `0`.
- **Open with Enter.** `k` then `Enter`. `.bundled-message.visible` is `2`; cursor and
  Gmail's mark are both `Work 1`.
- **Archive inside.** `e`. `window.__gmail.actions` equals
  `[{ type: 'archive', subjects: ['Work 1'] }]`.
- **Walk through and out.** `j`, `j`: cursor `Loose B`.
- **Escape collapses.** `k`, `Escape`. `.bundled-message.visible` is `0`, cursor is
  `Work`, `sessionStorage['inbundly:openBundle:v1']` is `null`.
- **Inert shortcut on the row.** `s`: `window.__gmail.actions` is unchanged.
- **Archive the bundle from its row.** `e`. `tr.zA.x7:not(.bundle-row)` count is `2`;
  polled, `window.__gmail.clicks` contains `act:7` and `window.__gmail.actions` gains
  `{ type: 'archive', subjects: ['Work 1', 'Work 2'] }`.
- **Mouse open moves the cursor.** Clear the selection with the Work bundle checkbox
  (`Select all messages in this bundle`), then click the `News` bundle row. Cursor and
  Gmail's mark are `News 1`.
- **Proof.** `evidence/<RUN_ID>/keyboard-nav/02-j-walks-onto-the-work-bundle-row-inbox.png`
  shows the ring on the bundle row, `05-enter-opens-work-and-lands-on-its-first-thread-inbox.aria.txt`
  shows the open bundle, and `walk.md` records the cursor, Gmail's mark, and the action log
  at every step.

## Gotchas

- The fixture models Gmail's cursor as the extension understands it (rows focusable,
  `btb` following DOM focus, `j`/`k` over Gmail's DOM-ordered list). Live Gmail is the only
  proof of that model; `TESTING.md` 12.9 is the manual canary. A `PASS` here proves the
  extension's behavior on that model, not the model.
- `inboxPage({ cursorFollowsFocus: false })` builds a Gmail whose cursor ignores focus;
  the spec's second block uses it to prove the toolbar fallbacks for `e` / `x` / `Enter`.
  The drive walks the default (following) model only.
- Use `page.keyboard.press`, never a synthetic `KeyboardEvent`: the extension ignores
  untrusted keys on purpose (they are meant for Gmail).
- After `e` on a bundle row the two threads stay selected (the fixture does not archive);
  clear the selection with the bundle checkbox before the next step, or later `e` presses
  act on the selection.
- The `Work` bundle row's text is `Work (2)` while collapsed and `Work` while open; the
  cursor reader uses the label span only.
