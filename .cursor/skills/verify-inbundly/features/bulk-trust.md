# Archive-all and date sweep switches

Inbundly's own archive controls, the archive-all icon on a bundle row (and its `e` / `y`
shortcut) and the sweep icon on a date divider, take three Options switches, all off by
default: leave starred (pinned) threads in place, mark the threads read first through
Gmail's own toolbar `Mark as read`, and click the star off the threads being archived.
The switches are read at click time, so flipping one applies to the next click without a
Gmail refresh or a rebundle. Gmail's own archive paths are untouched.

## Sub-features

- `trust-default-sweep` with every switch off, the date sweep selects every row in its
  section, pinned included, and clicks Gmail's Archive (`act="7"`) and nothing else.
- `trust-skip-starred-sweep` with `skipStarredOnArchive` on, the sweep leaves the starred
  row unselected; Gmail's archive lands without it and its star stays.
- `trust-skip-starred-bundle` with `keepStarredUnbundled` off (so the pinned thread sits
  inside its bundle), archive-all skips it the same way.
- `trust-skip-checked-pin` a pinned row the user checked by hand is deselected before the
  toolbar click, so it never rides along.
- `trust-mark-read` with `markReadOnArchive` on, archive-all clicks Gmail's `Mark as
  read` before `Archive`, on the same selection; an all-read selection goes straight to
  `Archive`.
- `trust-unstar` with `unstarOnArchive` on, the star is clicked off each starred thread
  being archived before the toolbar click; a skipped pin keeps its star.
- `trust-no-refresh` flipping any of the three asks Gmail for no refresh
  (`window.__gmail.refreshes` stays `0`).
- `trust-shortcut` `e` on a bundle row runs archive-all under the same switches.

## How to get to it (user POV)

- Options, then Features, then `Archive-all and date sweep`: the three switches
  `Leave starred (pinned) messages in place ...`, `Mark messages as read when archiving
  them this way ...`, `Remove the star from messages when archiving them this way ...`.
- In the Inbox, the check-all icon at the right of a date heading (`Today`) sweeps that
  section; hover a bundle row and click its archive icon for the bundle.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads, all from today: `Work 1` (label `Work`, unread), `Work 2`
  (`Work`), `Work pinned` (`Work`, starred), `Outside message` (no label). This is the
  `bulk-trust` seed in `scripts/drive.js` and the thread list of `e2e/bulk-trust.spec.js`.
  With the default `keepStarredUnbundled`, `Work pinned` is a plain row outside the bundle
  and only the date sweep reaches it.
- `const sweep = page.locator('.date-row .archive-bundle')` and
  `const work = page.locator('.bundle-row', { hasText: 'Work' })`. Click both icons with
  `dispatchEvent('click')` (hover `work` first), as the specs do; see Gotchas.
- Locate rows by exact subject (`.y6 span span` text), not `hasText('Work 1')`: every
  row's text also holds its label chip and date (`Work 10:00 AM`).

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive bulk-trust`.
  Nine walk steps `PASS` and `e2e/bulk-trust.spec.js` reports `10 passed`;
  `evidence/<RUN_ID>/bulk-trust/RESULT` reads `PASS`.
- **Default sweep.** `await sweep.dispatchEvent('click')`. `tr.zA.x7:not(.bundle-row)` count is `4`;
  polled, `window.__gmail.clicks` is `['act:7']` and `window.__gmail.actions` is one
  `archive` with all four subjects; `Work pinned` still has `.T-KT-Jp`.
- **Skip starred, on the real Options page.** Open
  `chrome-extension://<id>/options/options.html` and click
  `label.switch:has(#skip-starred-on-archive-checkbox) .slider`. `#save-status` gains
  `visible`; `chrome.storage.sync` (through the service worker) is
  `{ skipStarredOnArchive: true }`; the Gmail tab's `window.__gmail.refreshes` stays `0`.
- **Sweep leaves the pin.** Open a fresh inbox tab, `await sweep.dispatchEvent('click')`. Three rows
  selected, `Work pinned` has no `x7`, the archive action's subjects are
  `['Work 1', 'Work 2', 'Outside message']`, the star is still on.
- **Mark read first.** Flip `#mark-read-on-archive-checkbox` on. Fresh inbox tab,
  `await work.hover()`, `await work.locator('.archive-bundle').dispatchEvent('click')`. Polled,
  `window.__gmail.clicks` is `['Mark as read', 'act:7']` and the actions are
  `markRead` then `archive`, both with `['Work 1', 'Work 2']`; the `Work 1` row now has
  `yO`.
- **Unstar what is archived.** Flip `#unstar-on-archive-checkbox` on and
  `#skip-starred-on-archive-checkbox` off. Fresh inbox tab, `await sweep.dispatchEvent('click')`. Four
  rows selected, `Work pinned` has `.aXw` (no `.T-KT-Jp`) right away, and the actions
  read `unstar`, `markRead`, `archive` in that order.
- **Restore.** Flip `mark-read` and `unstar` off again; sync holds the three explicit
  `false`s.
- **Proof.** `evidence/<RUN_ID>/bulk-trust/04-sweep-leaves-the-pinned-thread-in-place-inbox.png`
  shows three selected rows with the pinned one plain;
  `06-archive-all-marks-the-bundle-read-first-inbox.aria.txt` and `walk.md` carry the
  recorded toolbar clicks and actions.

## Gotchas

- The fixture ships no Gmail stylesheet, so the date-row sweep icon (sized by Gmail's
  own `.bqX` class) has no box: a pointer `click()` waits forever on visibility. The
  archive icon on a hovered bundle row can likewise sit under a neighbouring cell. Use
  `dispatchEvent('click')` for both; in live Gmail they are ordinary click targets.
- `chrome.storage.sync.get(null)` returns keys in alphabetical order; write expected
  objects that way (`markReadOnArchive`, `skipStarredOnArchive`, `unstarOnArchive`)
  when comparing by JSON.
- The fixture does not take archived rows away, and a toolbar action only fires once the
  selection reveals Gmail's toolbar cluster. After one sweep every row stays selected and
  the cluster stays visible, so the next action would never fire in the same tab: open a
  fresh inbox tab per action (the walk does), or clear the selection first.
- The `Mark as read` step depends on Gmail's envelope reading `Mark as read` for the
  selection; the fixture flips it to `Mark as unread` once the selection is all read, as
  Gmail does. An all-read selection therefore logs only `act:7`; that is correct, not a
  miss.
- `Mark as read` and `Archive` land on two tasks (the second click is deferred one task
  so it hits the freshest toolbar button). Poll `window.__gmail.clicks`; a synchronous
  read right after the click may show only the first.
- Unstar goes through the row's own star (`.T-KT-Jp` `.click()`), before the selection,
  so `.aXw` is visible synchronously after the icon click while the toolbar click is
  still pending.
- With `skipStarredOnArchive` on, a section holding nothing but starred threads makes the
  icon a no-op (no selection, no toolbar click). Not in the walk; `test/ArchiveAction.test.js`
  covers it.
- What Gmail does after the toolbar clicks (marking read server-side, moving to All Mail,
  the star leaving Starred) is not emulated; `TESTING.md` section 15 keeps those manual.
