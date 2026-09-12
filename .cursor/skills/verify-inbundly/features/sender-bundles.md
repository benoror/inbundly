# Sender bundles

When a thread has no label, Inbundly can still bundle it by who sent it: two or more
unlabeled threads from the same domain form a bundle titled with the domain, and on freemail
domains (gmail.com, outlook.com, and so on) the bundle is keyed by the exact address
instead. Labeled threads never sender-bundle, a single thread from a sender stays a plain
row, sender bundles render without a label color, and their `View all` link runs a `from:`
search.

## Sub-features

- `sender-domain` two unlabeled threads from `acme.com` addresses form one bundle titled
  `acme.com` with count `(2)`.
- `sender-freemail` two threads from `jane@gmail.com` form a bundle titled by the full
  address; `john@gmail.com` with one thread does not join it.
- `sender-label-wins` labeled threads bundle by label, never by sender, so no
  `initech.com` bundle forms even though three initech threads exist.
- `sender-single-loose` a lone sender thread stays a plain row regardless of
  `skipSingleItemBundles`.
- `sender-uncolored` sender bundle rows have no `label-colored` class.
- `sender-view-all` the `View all` link searches `from:(@domain)` or `from:(address)`.

## How to get to it (user POV)

- Open the Inbox (or a category tab like Promotions) with `Sender bundles` on in Options
  (default); unlabeled newsletters and notifications from one domain collapse into a bundle
  named after the domain.
- Click a sender bundle to expand it; click `View all` on the row to open Gmail's search
  for that sender.
- Options, then the `Sender bundles` switch, turns the feature off; the inbox rebundles
  live.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Newsletter 1` (`news@acme.com`), `Your invoice`
  (`billing@acme.com`), `Hi 1` and `Hi 2` (`jane@gmail.com`), `From John`
  (`john@gmail.com`), `Sprint 1` and `Sprint 2` (`team@initech.com`, label `Work`), and
  `Loose initech mail` (`extra@initech.com`). This is the `sender-bundles` seed in
  `scripts/drive.js` and the thread list of `e2e/sender-bundles.spec.js`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive sender-bundles`.
  Four walk steps `PASS` and `e2e/sender-bundles.spec.js` reports `5 passed`;
  `evidence/<RUN_ID>/sender-bundles/RESULT` reads `PASS`.
- **Load the inbox.** `const page = await openInbox(context)`.
  `page.locator('.bundle-row', { hasText: 'acme.com' })` has count `1` and `.bundle-count`
  `(2)`; `page.locator('.bundle-row', { hasText: 'jane@gmail.com' })` has count `1` and
  `(2)`; `.bundle-row:has-text("john@gmail.com")` and `.bundle-row:has-text("initech.com")`
  have count `0`; `.bundle-row:has-text("Work")` has count `1`.
- **Loose rows stay plain.** `page.locator('tr.zA', { hasText: 'From John' })` and
  `page.locator('tr.zA', { hasText: 'Loose initech mail' })` have no `bundled-message`
  class.
- **Uncolored.** The acme bundle row has no `label-colored` class.
- **View all.** `acme.locator('.view-all-link')` has an `href` containing
  `from%3A%40acme.com`; `jane.locator('.view-all-link')` has one containing
  `from%3Ajane%40gmail.com`.
- **Expand and collapse.** `await acme.click()`: `.bundled-message.visible` count is `2`
  and both `Newsletter 1` and `Your invoice` are among them; `await acme.click()` again
  brings the count to `0`.
- **Proof.** `evidence/<RUN_ID>/sender-bundles/01-inbox-bundled-inbox.png` shows the
  `acme.com`, `jane@gmail.com`, and `Work` bundles with the loose rows below;
  `03-open-acme-bundle-inbox.png` shows the two acme threads expanded.

## Gotchas

- Sender bundles need two or more threads; a fixture with one thread per domain shows no
  sender bundle at all and `openInbox` (which waits for `.bundle-row`) times out. Pass
  `openInbox(context, { expectBundles: false })` for such scenarios.
- The sender is read from `span[email]` on the row; fixture threads without `email` fall
  back to `someone@example.com` and will bundle together unexpectedly.
- Subdomains split bundles (`e.crm.lego.com` is not `lego.com`); that is a known
  limitation (`TESTING.md` 3.10), not a regression.
- Label precedence means adding a label to one acme thread in the fixture silently
  dissolves the acme bundle; keep sender-bundle seeds unlabeled.
