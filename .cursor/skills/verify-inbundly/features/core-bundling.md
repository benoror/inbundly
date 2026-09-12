# Core bundling

Threads that share a Gmail label collapse into one bundle row that shows the label, a
message count, a senders preview, and the latest date. Clicking the row expands its
messages in place; clicking it again, or clicking outside any row, collapses it. Threads
whose label has a single message, and unlabeled one-offs, stay plain Gmail rows. In the
single-section Default inbox, date dividers (Today, This month, and so on) group the list.

## Sub-features

- `core-form` two or more threads with the same label form one `.bundle-row` with
  `.bundle-count` `(N)` and a `.bundle-senders` preview.
- `core-combined` when labels are combined (default on), each distinct label set forms its
  own bundle titled by the shared parent plus the extra label (`Work` and `Urgent`).
- `core-expand` clicking a bundle row shows its messages (`.bundled-message.visible`)
  under an open-bundle backdrop (`.bundle-area`).
- `core-collapse` clicking the open row again hides them.
- `core-outside-close` clicking outside any row (the backdrop) closes the open bundle.
- `core-plain-rows` a label with one thread and an unlabeled unique sender stay plain rows
  (no `bundled-message` class) when `skipSingleItemBundles` is on (default).
- `core-date-dividers` mixed thread ages yield at least two `.date-row` dividers.

## How to get to it (user POV)

- Open Gmail's Inbox with labels shown in the message list; bundles appear automatically
  on load and after Gmail rerenders the list.
- Click a bundle row to expand; click again or click the backdrop below the open messages
  to collapse.
- Open Options (toolbar icon, then Options) to change combine labels, single-item bundles,
  or date grouping; the inbox rebundles live.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Work update 1` and `Work update 2` (label `Work`), `Urgent work A`
  and `Urgent work B` (labels `Work` and `Urgent`), `Lone receipt` (label `Receipts`), and
  `Just a message` (no label, 40 days old). This is the `core-bundling` seed in
  `scripts/drive.js` and the thread list of `e2e/bundling.spec.js`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive core-bundling`.
  Walk steps `inbox-bundled`, `open-work-bundle`, `collapse-work-bundle`,
  `open-combined-then-click-outside` all `PASS`, then `e2e/bundling.spec.js` reports
  `5 passed`. `evidence/<RUN_ID>/core-bundling/RESULT` reads `PASS`.
- **Load the inbox.** `const page = await openInbox(context)` (waits for `.bundle-row`).
  `page.locator('.bundle-row', { hasText: 'Work' }).filter({ hasNot: page.locator('text=Urgent') })`
  has count `1` and its `.bundle-count` reads `(2)`; `page.locator('.bundle-row', { hasText: 'Urgent' })`
  has count `1` with `.bundle-and-count` containing `Work`; `.bundled-message` count is `4`;
  `.date-row` count is at least `2`.
- **Plain rows stay plain.** `page.locator('tr.zA', { hasText: 'Lone receipt' })` and
  `page.locator('tr.zA', { hasText: 'Just a message' })` have no `bundled-message` class;
  `.bundle-row:has-text("Receipts")` has count `0`.
- **Expand.** Click the Work bundle row: `await work.click()`. `.bundled-message.visible`
  count is `2`, the row has class `visible`, `.bundle-area` count is `1`.
- **Collapse.** `await work.click()` again. `.bundled-message.visible` count is `0` and the
  row no longer has class `visible`.
- **Outside click closes.** Click the Urgent bundle, wait for a visible message, then
  `await page.locator('.bundle-area').dispatchEvent('click')`. `.bundled-message.visible`
  is `0` and `.bundle-row.visible` is `0`.
- **Proof.** `evidence/<RUN_ID>/core-bundling/02-open-work-bundle-inbox.png` shows the two
  Work messages under the open row and `03-collapse-work-bundle-inbox.png` shows them
  hidden again; `walk.md` lists every observed value.

## Gotchas

- `hasText: 'Work'` also matches the combined `Work Urgent` bundle; filter with
  `hasNot: page.locator('text=Urgent')` (the spec does) or the count is `2`.
- The fixture renders the label chip text inside the subject cell, so a `tr.zA` locator
  by subject also matches the label name; assert on the class list, not on text absence.
- The backdrop `.bundle-area` has no layout box in the fixture, so a real click cannot
  target it; `dispatchEvent('click')` is the sanctioned stand-in for clicking outside the
  list (the spec uses it).
- Date dividers only render in the single-section Default inbox; multi-section inbox types
  are unit-tested and manual only, not driveable here.
- `openInbox` waits up to 10 seconds for `.bundle-row`; a timeout there almost always means
  `dist/content.js` is stale or missing (run `doctor`).
