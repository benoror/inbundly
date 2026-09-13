# Collapsed-row glance

A closed bundle row tells who wrote last and when, without being opened: on its right
side, the newest thread's most recent sender sits just before that thread's date, the way
a Gmail thread row reads (sender, then date). Both go bold when that thread is unread,
like Gmail's unread rows; otherwise the sender is in the muted weight of a snippet.
Hovering the sender shows the address; hovering the date shows Gmail's full date. The
senders peek next to the bundle title still lists every sender, most recent first. The
glance belongs to the closed row: it hides while the bundle is open.

## Sub-features

- `glance-sender-date` the closed row shows `.bundle-latest-sender` followed by
  `.bundle-date`, both from the bundle's newest thread.
- `glance-unread` an unread newest thread makes both bold (`unread` class, computed
  weight `700`); a read one leaves the sender at normal weight.
- `glance-tooltips` the sender's `title` is the address; the date's `title` is Gmail's
  full-date tooltip.
- `glance-peek-order` `.bundle-senders` lists senders most recent first, so its first
  name is the glance's sender.
- `glance-hides-open` opening the bundle hides the sender and the date; collapsing shows
  them again.

## How to get to it (user POV)

- Open Gmail's Inbox with labels shown in the message list; every closed bundle row
  shows the glance at its right edge, next to the bundle actions.
- Hover the sender or the date on a closed bundle row for the address or the full date.
- Click the row to open the bundle; the glance gives way to the row's `View all` link.
  Click again to collapse and get it back.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Q3 numbers` (`Jane Doe <jane@acme.com>`, label `Work`, unread,
  today) and `Standup notes` (`Bob <bob@acme.com>`, `Work`, 3 days ago); `Issue 41` and
  `Issue 40` (`Weekly Digest <digest@news.example>`, label `News`, read, 10 and 17 days
  ago). This is the `collapsed-glance` seed in `scripts/drive.js` and the thread list of
  `e2e/collapsed-glance.spec.js`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive collapsed-glance`.
  Walk steps `inbox-glance`, `open-work-hides-glance`, `collapse-work-shows-glance` all
  `PASS`, then `e2e/collapsed-glance.spec.js` reports `3 passed`.
  `evidence/<RUN_ID>/collapsed-glance/RESULT` reads `PASS`.
- **Load the inbox.** `const page = await openInbox(context)`. On
  `page.locator('.bundle-row', { hasText: 'Work' })`: `.bundle-latest-sender` reads
  `Jane Doe` with `title` `jane@acme.com` and class `unread`; `.bundle-date` reads
  `10:00 AM` with class `unread`; `.bundle-senders` reads `Jane Doe, Bob`. On the `News`
  row: `.bundle-latest-sender` reads `Weekly Digest` without `unread`; `.bundle-date`
  reads the fixture's `Sep 3`-style text for ten days ago and its `title` equals
  `dateTitle(10)` from `e2e/fixture/inbox.js`.
- **Weight.** `getComputedStyle(el).fontWeight` on the Work sender is `700`, on the News
  sender `400`.
- **Open hides.** `await work.click()`; `.bundled-message.visible` count is `2`;
  `work.locator('.bundle-latest-sender')` and `work.locator('.bundle-date')` are hidden.
- **Collapse shows.** `await work.click()` again; both are visible and the sender still
  reads `Jane Doe`.
- **Proof.** `evidence/<RUN_ID>/collapsed-glance/01-inbox-glance-inbox.png` shows
  `Jane Doe 10:00 AM` in bold on the Work row and `Weekly Digest` muted on the News row;
  `walk.md` lists every observed value.

## Gotchas

- The fixture ships no Gmail stylesheet, so the glance is not right-aligned in
  screenshots and cells may overlap; read positions from the ARIA snapshot and
  `walk.md`, and use the screenshots for the bold/muted contrast only.
- `hasText: 'Work'` is unambiguous in this seed (no combined bundle); in the
  `core-bundling` seed it also matches `Work Urgent`.
- The News date is computed in the test from today's date; a drive that crosses
  midnight between serving the fixture and asserting can fail that one check. Rerun.
- The glance hides under `.bundle-row.visible` via the date cell's `display: none`, so
  `isVisible()` is the right probe; `toHaveCount` would still find the nodes.
- The vertical-split reading pane (`.Zs`) hides the sender and keeps the date alone;
  the fixture does not render that layout, so that rule is manual only.
