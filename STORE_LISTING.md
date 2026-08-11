# Inbundly — Chrome Web Store & Firefox AMO listing copy

Ready-to-paste content for submission. (Not shipped in the extension.)

## Name (title)
```
Inbundly – Inbox Bundles for Gmail
```

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
than the original, with custom bundles, priority rules, and label coloring.

FEATURES
• Label bundles — messages sharing a Gmail label are grouped into one collapsible bundle.
• Custom bundles — select any messages and bundle them on the fly, no label needed. They
  sync across your signed-in Chrome browsers.
• Priority bundles — force chosen labels (or label sets) to always group together, with
  subtree wildcards and first-match-wins rules.
• Label colors — tint bundles to match their Gmail label color: a subtle background fill
  or an accent bar, both theme-aware.
• Skip single-item bundles, quick-archive a whole bundle, and pin a message outside its
  bundle by starring it.
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
into collapsible "bundles" (by label or by user-defined custom bundles) to make email easier
to manage.
```

## Permission justifications
- **storage** — Save the user's options and their custom bundles (via `chrome.storage.sync`)
  so preferences and groupings persist and sync across the user's own signed-in browsers.
- **declarativeContent** — Show the extension's toolbar action only when the user is on
  `mail.google.com`, without reading page content.
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
```
