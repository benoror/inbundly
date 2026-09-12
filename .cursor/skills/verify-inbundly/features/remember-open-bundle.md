# Remember the open bundle

Inbundly remembers which bundle the user opened, per Gmail page and tab, for the life of
the browser session. Reloading the tab reopens that bundle in place. Collapsing it, or
closing it by clicking outside, forgets it, so the next reload shows a fully collapsed list.
The option `rememberOpenBundle` (default on) gates the restore.

## Sub-features

- `remember-write` opening a bundle stores `{ label }` under
  `sessionStorage['inbundly:openBundle:v1']`.
- `remember-restore` after `page.reload()` the same bundle is open again with its messages
  visible.
- `remember-forget-collapse` clicking the open row to collapse clears the store; a reload
  then keeps everything closed.
- `remember-forget-backdrop` closing by clicking the backdrop below the open messages
  clears the store too.

## How to get to it (user POV)

- In the Inbox, click a bundle to open it, then reload the tab: the bundle is open again.
- Click the open bundle row (or anywhere outside the rows) to close it, reload: nothing is
  open.
- Options, then `Remember the open bundle`, turns the restore off.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Work 1` and `Work 2` (label `Work`), `News 1` and `News 2`
  (label `News`). This is the `remember-open-bundle` seed in `scripts/drive.js` and the
  thread list of `e2e/remember-open-bundle.spec.js`.
- `const store = () => page.evaluate(k => sessionStorage.getItem(k), 'inbundly:openBundle:v1')`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive remember-open-bundle`.
  Six walk steps `PASS` and `e2e/remember-open-bundle.spec.js` reports `3 passed`;
  `evidence/<RUN_ID>/remember-open-bundle/RESULT` reads `PASS`.
- **Fresh load.** `const page = await openInbox(context)`. `.bundle-row` count is `2` and
  `store()` is `null`.
- **Open Work.** `await page.locator('.bundle-row', { hasText: 'Work' }).click()`.
  `.bundled-message.visible` count is `2` and `JSON.parse(await store()).label` is `Work`.
- **Reload restores.** `await page.reload(); await page.waitForSelector('.bundle-row.visible')`.
  `.bundle-row.visible .bundle-and-count` reads `Work (2)` and `.bundled-message.visible`
  count is `2`.
- **Collapse forgets.** Click the Work row again. `.bundled-message.visible` is `0` and
  `store()` is `null`.
- **Reload stays closed.** `await page.reload(); await page.waitForSelector('.is-bundled')`.
  `.bundle-row.visible` count is `0`.
- **Backdrop close forgets.** Click the News row, wait for a visible message, then
  `await page.locator('.bundle-area').dispatchEvent('click')`. `.bundled-message.visible`
  is `0` and `store()` is `null`.
- **Proof.** `evidence/<RUN_ID>/remember-open-bundle/02-open-work-inbox.png` and
  `03-reload-reopens-work-inbox.png` show the same open bundle before and after the reload;
  `walk.md` records the store value at each step.

## Gotchas

- The store is `sessionStorage`, so it is per tab and per browser session: a new
  `context.newPage()` starts empty even in the same profile. Reload the same page to test
  restore; do not open a second page and expect the bundle open.
- After a reload with nothing remembered, wait for `.is-bundled` (the list wrapper stamp),
  not `.bundle-row.visible`, or the wait times out and reads as a failure.
- The key is scoped by Gmail page and tab; the fixture is always `#inbox` on `Primary`, so
  the cross-page case (`TESTING.md` 4.4) is unit-tested only.
- Rerenders must not clear the memory; if a restore fails right after Gmail redraws the
  list, suspect a write from a render path rather than the store itself.
