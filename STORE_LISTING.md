# Inbundly: Chrome Web Store, Firefox AMO, and Microsoft Edge Add-ons listing copy

Ready-to-paste content for submission. (Not shipped in the extension.)

## Name (title)
```
Inbundly
```
(From the manifest `name`; drives the vanity URL slug `inbundly`. Keyword phrase
"Inbox Bundles for Gmail" lives in the summary/description below.)

## Short description (≤132 chars)
```
Bring Google Inbox-style bundles to Gmail: auto-group emails by label into tidy, collapsible bundles. Organize your inbox, fast.
```

## Category
Productivity

## Support & links
- Support email: `support@inbundly.com`
- Support / homepage URL: `https://inbundly.com`
- Support (issues): `https://github.com/benoror/inbundly/issues`
- Privacy policy: `https://inbundly.com/privacy.html`

## Detailed description
```
Inbundly brings back the best part of Google Inbox — bundles — to Gmail.

It automatically groups your email by label into tidy, collapsible bundles right in your
inbox, so related messages stay together and your inbox stays calm. And it goes further
than the original, with sender bundles, custom bundles, priority rules, and label coloring.

FEATURES
• Label bundles — messages sharing a Gmail label are grouped into one collapsible bundle.
• Combine labels — bundle each distinct set of labels together, so threads labeled A + B
  form their own bundle, separate from just A.
• Custom bundles — select any messages and bundle them on the fly, no label needed. They
  sync across the browsers signed in to your browser account.
• Priority bundles — force chosen labels (or label sets) to always group together, with
  subtree wildcards and first-match-wins rules.
• Sender bundles — unlabeled mail that shares a sender groups by domain (or exact
  address on gmail.com & friends). Labels, priority, and custom still win.
• Keep starred messages outside bundles — Inbox-style pinning. Toggle under
  Options → Bundle setup.
• Remember the open bundle — reload, refresh, or bounce through Inbox — the bundle you
  had open comes back (per tab/page, for the session).
• Bundle bulk actions — select-all, archive-all, snooze-all, or delete/trash-all from
  the bundle row. Each control uses Gmail’s own toolbar actions on every thread in the
  bundle. Toggle individually under Options → Features.
• Master switch — pause bundling without disabling the extension. The same
  “Bundle my inbox” switch lives in Gmail’s search bar, Options, and the toolbar popup.
• All inbox types — Default, Important/Unread/Starred first, Priority Inbox, and
  Multiple Inboxes, each visible section independently.
• Label colors — tint bundles to match their Gmail label color: a subtle background fill
  or an accent bar, both theme-aware.
• Options autosave — no Save button. Change a setting and it’s stored; new defaults
  reach installs that never touched that option.
• Sync & backup — options and custom bundles sync across signed-in browsers; export or
  import JSON under Options → Sync & backup when you need a hand-off.
• Light & dark — follows your Gmail theme with careful, readable colors.

PRIVATE BY DESIGN
Inbundly runs entirely in your browser. No accounts, no servers, no tracking, no analytics.
It never sends your email anywhere. It only reorganizes how your inbox is displayed.

OPEN SOURCE
Free software under GPL-3.0. Source: https://github.com/benoror/inbundly
Inbundly is a rebranded, maintained fork of the open-source "inboxy" by Teresa Ou.

Not affiliated with Google. Gmail is a trademark of Google LLC.
```

## Single-purpose statement
```
Inbundly has a single purpose: to visually reorganize the Gmail inbox by grouping messages
into collapsible "bundles" (by label, sender, or user-defined custom bundles) to make email
easier to manage.
```

## Permission justifications
- **storage** — Save the user's options and their custom bundles (via `chrome.storage.sync`)
  so preferences and groupings persist and sync across the user's own signed-in browsers.
- **Host access: `*://mail.google.com/mail/*`** — The content script must run on Gmail to
  read the already-rendered message list and restructure it into bundles. No other sites.

## Data usage / privacy disclosure
- Does the extension collect user data? **No.**
- No data is sold or transferred to third parties. No data leaves the browser.
- Privacy policy URL: https://inbundly.com/privacy.html

## Assets checklist (see plan §3 / §5)
- [ ] Store icon 128×128 (use `dist/icons/inbundly-dark-128.png`)
- [ ] Screenshots 1280×800 ×3–5 — **capture in BOTH light and dark** (bundles in Gmail + options page)
- [ ] Small promo tile 440×280
- [ ] (optional) Marquee 1400×560
- [ ] Privacy policy live at https://inbundly.com/privacy.html

## Firefox AMO
Same package; AMO also supports `theme_icons`. Reuse the name, descriptions, and screenshots.

## Microsoft Edge Add-ons

Submitted through Partner Center (Edge program). The package is the Chrome build: no
`key`, no `update_url`, no Firefox settings, and the name and description don't say
"Chrome" (Microsoft's port guide). Name and short description come from the manifest and
are read-only in Partner Center.

**Package:** `npm run package:edge` (or `just package-edge`) builds
`packages/inbundly-<version>-edge.zip`. Upload that zip under Packages.

### Availability
- Visibility: **Public**
- Markets: **all markets** (default)

### Properties
- Category: **Productivity**
- Website: `https://inbundly.com`
- Support contact: `support@inbundly.com`
- Mature content: **No** (leave unchecked)

### Privacy

**Single purpose** (paste the single-purpose statement above).

**Permission justification** (the manifest asks for `storage` plus host access to Gmail):
```
storage: Saves the user's Inbundly options and custom bundles with chrome.storage.sync, so
they persist across browser restarts and follow the user to their other browsers through the
browser's own sync. Nothing is sent to the developer.
```
```
Host access (*://mail.google.com/mail/*): The content script runs only on Gmail. It reads
the message list Gmail has already rendered (senders, subjects, labels, dates) and regroups
it on the page into collapsible bundles. It runs on no other site and makes no network
requests.
```

**Are you using remote code?** **No, I am not using remote code.** (Manifest V3; all
JavaScript ships in the package and is built from the public repository.)

**Data usage:**
- What user data do you plan to collect? **Check none.** Inbundly reads the Gmail page
  locally to rearrange it but never transmits, stores off-device, or shares it. Saved
  options and custom bundles stay in the browser's own extension storage.
- Certifications: check all three (data is not sold or transferred to third parties outside
  the approved use cases; not used or transferred for purposes unrelated to the single
  purpose; not used or transferred to determine creditworthiness or for lending).

**Privacy policy URL:** `https://inbundly.com/privacy.html`

### Store listing (English, en-US)

**Description** (browser-neutral, about 2,700 characters; Partner Center needs 250 to 10,000):
```
Inbundly brings back the best part of Google Inbox, bundles, to Gmail.

It automatically groups your email by label into tidy, collapsible bundles right in your
inbox, so related messages stay together and your inbox stays calm. And it goes further
than the original, with sender bundles, custom bundles, priority rules, and label coloring.

FEATURES
• Label bundles: messages sharing a Gmail label are grouped into one collapsible bundle.
• Combine labels: bundle each distinct set of labels together, so threads labeled A + B
  form their own bundle, separate from just A.
• Custom bundles: select any messages and bundle them on the fly, no label needed. They
  sync across the browsers signed in to your browser account.
• Priority bundles: force chosen labels (or label sets) to always group together, with
  subtree wildcards and first-match-wins rules.
• Sender bundles: unlabeled mail that shares a sender groups by domain (or exact
  address on gmail.com & friends). Labels, priority, and custom still win.
• Keep starred messages outside bundles: Inbox-style pinning. Toggle under
  Options → Bundle setup.
• Remember the open bundle: reload, refresh, or bounce through Inbox and the bundle you
  had open comes back (per tab/page, for the session).
• Bundle bulk actions: select-all, archive-all, snooze-all, or delete/trash-all from
  the bundle row. Each control uses Gmail’s own toolbar actions on every thread in the
  bundle. Toggle individually under Options → Features.
• Master switch: pause bundling without disabling the extension. The same
  “Bundle my inbox” switch lives in Gmail’s search bar, Options, and the toolbar popup.
• All inbox types: Default, Important/Unread/Starred first, Priority Inbox, and
  Multiple Inboxes, each visible section independently.
• Label colors: tint bundles to match their Gmail label color, as a subtle background fill
  or an accent bar, both theme-aware.
• Options autosave: no Save button. Change a setting and it’s stored; new defaults
  reach installs that never touched that option.
• Sync & backup: options and custom bundles sync across signed-in browsers; export or
  import JSON under Options → Sync & backup when you need a hand-off.
• Light & dark: follows your Gmail theme with careful, readable colors.

PRIVATE BY DESIGN
Inbundly runs entirely in your browser. No accounts, no servers, no tracking, no analytics.
It never sends your email anywhere. It only reorganizes how your inbox is displayed.

OPEN SOURCE
Free software under GPL-3.0. Source: https://github.com/benoror/inbundly
Inbundly is a rebranded, maintained fork of the open-source "inboxy" by Teresa Ou.

Not affiliated with Google or Microsoft. Gmail is a trademark of Google LLC.
```

**Images** (all reused from the Chrome listing except the logo):
- Extension logo (1:1, 300x300 recommended): `store-assets/edge/logo-300.png` (300x300,
  no alpha; regenerate with `npm run store-assets` or `just store-assets`).
- Small promotional tile (440x280): `store-assets/chrome/promo-small-440x280.png`
- Large promotional tile (1400x560): `store-assets/chrome/promo-marquee-1400x560.png`
- Screenshots (1280x800, up to 6): `store-assets/chrome/1-*.png` through `5-*.png`, in
  order. They show only the Gmail page and the Options page with a caption bar: no browser
  frame, toolbar, or Chrome branding, so they work for Edge as is.
- YouTube video URL (optional): `https://www.youtube.com/watch?v=6EjHeNCD-N4`

**Search terms** (max 7 terms, 21 words, 30 characters each):
```
gmail bundles
inbox bundles
google inbox
email organizer
gmail labels
inbox zero
productivity
```

### Notes for certification
```
Inbundly works only on Gmail (mail.google.com). No account or login with us is needed;
use any Gmail account. To test:
1. Install the extension and open https://mail.google.com.
2. In the inbox, messages that share a Gmail label are grouped into one bundle row
   (for example "Work (3)"). Click a bundle row to open or close it. If the test inbox
   has no labels, mail from the same sender domain still groups into a bundle.
3. Click the toolbar icon: the popup has the "Bundle my inbox" switch and links to
   Options and Help. Turning the switch off ungroups the inbox live.
4. Options (toolbar popup > Options) changes settings; they save automatically.
The extension makes no network requests, has no background script, and uses only the
storage permission plus host access to Gmail. Source: https://github.com/benoror/inbundly
```

### Testing before upload
- `npm test` and `npm run test:e2e` (Chromium), plus `INBUNDLY_E2E_CHANNEL=msedge npm run
  test:e2e` with Microsoft Edge installed, which runs the same suite in Edge.
- Manual: TESTING.md row 17.2 (load the packaged Edge build in Edge and walk Gmail).
