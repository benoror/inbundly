# Bundles outside the Inbox

With the `Also bundle outside the inbox` switch on (Options, Bundling; off by default),
Inbundly bundles the other Gmail list views the same way it bundles the Inbox: search
results, label views, Snoozed, Starred, Important, and All Mail. Two things differ from
the Inbox. Gmail's own chips (the `Inbox` chip a search result shows, `Sent`, `Draft`)
are never bundles. And whatever the view is already filtered by is not bundled again: in
the label view of `Work`, or on the `Work` bundle's own `View all` search, the threads
group by their other labels or by sender instead of collapsing into one `Work` row.
`View all` links stay inside the view (`in:snoozed`, the search's own query, the viewed
label). Conversations, Sent, Drafts, Spam, Trash, and the pinned page (starred in inbox)
are left alone.

## Sub-features

- `views-off-by-default` a search results page is a plain Gmail list until the option is on.
- `views-live-flip` turning the option on rebundles the search the user is looking at
  (Inbundly asks Gmail to refresh; the repaint bundles); turning it off leaves it plain.
- `views-search-bundles` a search bundles by label and by sender; the `Inbox` chip is not
  a bundle.
- `views-own-filter` the viewed label (`#label/Work`), the `label:` terms of a search, and
  the `from:` sender of a search are not bundle keys there.
- `views-view-all-scope` `View all` on a bundle is scoped to the view it was drawn in.
- `views-snoozed` the Snoozed view bundles like a search.
- `views-untouched` conversations, Sent, Drafts, and the pinned page are not bundled.

## How to get to it (user POV)

- Options, Bundling, turn on `Also bundle outside the inbox`. Any search results page,
  label view, or Snoozed you are looking at rebundles at once.
- Search Gmail, open a label from the left nav, or open Snoozed: bundles appear, open
  and close like in the Inbox, and `View all` keeps you in that view.
- Turn the switch off to get the plain Gmail lists back; the Inbox keeps bundling.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture threads (served for every view, `tab: null` since Gmail shows no category tabs
  outside the Inbox): `Work update 1` and `Work update 2` (chips `Inbox`, `Work`),
  `Urgent work A` and `Urgent work B` (`Inbox`, `Work`, `Urgent`), `Acme 1` and `Acme 2`
  (`x@acme.com`, `y@acme.com`, chip `Inbox`), `Just a message` (no chips). This is the
  `other-views` seed in `scripts/drive.js` and the thread list of
  `e2e/other-views.spec.js`.
- Views are opened by hash with `openView(context, hash)` from `e2e/helpers/gmail.js`;
  `{ expectBundles: null }` asserts the extension left the list alone.
- Bundle titles are read from `.bundle-row .bundle-and-count > span:first-child`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive other-views`.
  Eight walk steps `PASS` and `e2e/other-views.spec.js` reports `11 passed`;
  `evidence/<RUN_ID>/other-views/RESULT` reads `PASS`.
- **Plain by default.** `openView(context, 'search/newsletters', { expectBundles: null })`:
  `.bundle-row` and `.is-bundled` both count `0`.
- **Flip on, live.** `setSyncOptions(context, { bundleOtherViews: true })`, then wait for
  `.bundle-row`. `window.__gmail.refreshes` is `1`; titles sorted are
  `['Work', 'Work + Urgent', 'acme.com']`; `.bundled-message` count is `6`;
  `Just a message` has no `bundled-message` class; the `Urgent` bundle's `.view-all-link`
  `href` ends `#search/newsletters+label%3AWork+label%3AUrgent`.
- **Open and collapse.** Click the `Work` bundle row (filtering out `Urgent`):
  `.bundled-message.visible` is `2`; click again: `0`.
- **Label view.** `openView(context, 'label/Work')`: titles `['Urgent', 'acme.com']`, both
  `Work update` rows plain, `Urgent` `View all` `href` ends
  `#search/label%3AWork+label%3AUrgent`.
- **View all search.** `openView(context, 'search/label%3AInbox+label%3AWork')`: titles
  `['Urgent', 'acme.com']`, `Work update 1` plain.
- **Snoozed.** `openView(context, 'snoozed')`: titles `['Work', 'Work + Urgent', 'acme.com']`;
  the `acme.com` `View all` `href` ends `#search/in%3Asnoozed+from%3A%40acme.com`.
- **Conversation.** `openView(context, 'search/newsletters/FMfcgzQbfVjhKLmnpQrsTuvWxyz',
  { expectBundles: null })`: `.bundle-row` count `0`.
- **Flip off.** On `search/newsletters`, `setSyncOptions(context, { bundleOtherViews: false })`:
  `.bundle-row` drops to `0`, `window.__gmail.refreshes` is `1`.
- **Proof.** `evidence/<RUN_ID>/other-views/02-option-on-rebundles-the-search-live-search.png`
  shows the three bundles on the search page, `04-label-view-does-not-bundle-its-own-label-label.aria.txt`
  the label view without a `Work` bundle, and `walk.md` the titles, hrefs, and refresh count
  at every step.

## Gotchas

- The option persists in the profile for the run: drive the plain-by-default step before
  flipping it, and flip it back off at the end (the walk does both).
- The live flip depends on the fixture's Refresh emulation (`act="20"` rebuilds the list
  from pristine rows). In live Gmail the refresh button does the same; the fixture only
  models it since this feature landed.
- A `View all` search is a search: with the option on, its results bundle too, minus the
  searched label or sender. That is the intended behavior, not a regression.
- The pinned page (`search/is%3Astarred+label%3Ainbox`) is not stamped `.is-bundled`; wait
  for `.date-row` there, as the spec does.
- Gmail hides the viewed label's chip in a label view; the fixture does not, so the label
  view seed still carries `Work` chips and proves the extension drops them itself.
