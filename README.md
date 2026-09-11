<p align="center">
  <img width="650" src="images/inbundly-banner.png" alt="Inbundly — Google Inbox-style bundles for Gmail">
</p>

# Inbundly: Google Inbox-style bundles for Gmail

**Inbundly** brings back the best part of Google Inbox — **bundles** — to Gmail, and keeps
going: it groups your email into tidy, collapsible bundles and adds more ways to organize
your inbox.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/pbfjicjmcpogjlbpljebhhgkgfhbdcga"><img alt="Chrome Web Store" src="https://img.shields.io/chrome-web-store/v/pbfjicjmcpogjlbpljebhhgkgfhbdcga?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white"></a>
  <a href="https://chromewebstore.google.com/detail/pbfjicjmcpogjlbpljebhhgkgfhbdcga"><img alt="Users" src="https://img.shields.io/chrome-web-store/users/pbfjicjmcpogjlbpljebhhgkgfhbdcga?label=users"></a>
  <a href="https://addons.mozilla.org/firefox/addon/inbundly/"><img alt="Firefox Add-on" src="https://img.shields.io/amo/v/inbundly?label=Firefox%20Add-ons&logo=firefoxbrowser&logoColor=white"></a>
  <a href="https://github.com/benoror/inbundly/blob/master/COPYING"><img alt="License: GPL-3.0" src="https://img.shields.io/badge/License-GPL--3.0-blue"></a>
  <a href="https://github.com/sponsors/benoror"><img alt="Sponsor" src="https://img.shields.io/badge/Sponsor-%E2%99%A5-db61a2?logo=githubsponsors&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://www.producthunt.com/products/inbundly?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-inbundly" target="_blank" rel="noopener noreferrer"><img alt="Inbundly - Bundle emails by label into tidy groups, right inside Gmail | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1244240&amp;theme=light&amp;t=1789162402563"></a>
</p>

## Install

- **Chrome / Edge / Brave:** [**Add to Chrome**](https://chromewebstore.google.com/detail/pbfjicjmcpogjlbpljebhhgkgfhbdcga) from the Chrome Web Store.
- **Firefox:** [**Add to Firefox**](https://addons.mozilla.org/firefox/addon/inbundly/) from Firefox Add-ons.
- **From source:** see [Setup](#setup) to build and load `dist/` as an unpacked extension.

> **Fork notice:** Inbundly is [benoror/inbundly](https://github.com/benoror/inbundly), a
> maintained, rebranded fork of [teresa-ou/inboxy](https://github.com/teresa-ou/inboxy)
> (originally by Teresa Ou), with additional options for combined-label bundles, bundle
> coloring, custom bundles, and Stylus theme-matching. Licensed GPL-3.0 (see
> [`NOTICE.md`](NOTICE.md) for the statement of changes).

## Features

* Messages with the same label are bundled together in your inbox
* Unlabeled messages that share a sender bundle by domain (or by exact
  address for personal-mail domains) — labels always win, and a sender
  bundle needs 2+ threads (on by default; Options → Bundle setup)
* The open bundle is remembered across reloads, refreshes, and page
  navigation for the browser session (on by default; Options → Features)
* Snooze a whole bundle: a bundle-row button opens Gmail's own snooze
  menu for all the bundle's threads (on by default; Options → Features)
* Delete/trash a whole bundle: a bundle-row button selects the threads
  and clicks Gmail's own Delete (off by default; Options → Features)
* Optionally bundle by the whole *set* of labels, so threads sharing labels
  A + B form their own bundle, colored by the first label (enable in Options)
* Priority bundles: force chosen labels (or label sets) to always group
  together regardless of a thread's other labels — e.g. `Bank`, `School/*`
  (subtree), or `Work + Urgent`; first matching rule wins (configure in Options)
* Custom bundles: select any messages in Gmail and click the floating
  "Bundle selected" button to group them on the fly — no Gmail label needed.
  Custom bundles override label-based grouping, stick across reloads, and sync
  with all other options to your other browsers signed into the same Chrome or
  Firefox account (`chrome.storage.sync`). Manage or delete them under
  Options → Custom bundles
* All Options page settings sync across devices the same way; a change on one
  browser updates Gmail tabs on the others without reloading the extension
* Single-item bundles are skipped by default, shown as regular messages
* Archive all bundled messages on the current page quickly
* Star a message to pin it outside of its bundle (on by default and configurable
  under Options → Bundle setup)
* Intuitive date headings
* Supports light and dark themes
* Optionally color bundles to match their Gmail label color — either a subtle
  background tint or just the left accent bar and text, both theme-aware
  (enable in Options)
* Select, archive, snooze, or delete all of a bundle's messages from its
  row: a Gmail-style select-all checkbox (Gmail's toolbar actions then
  apply to the selection) plus archive-all, snooze, and delete-all buttons
  shown on hover and while the bundle is open
* The pinned-messages toggle and delete-all button (hidden by default)
  and the archive-all and snooze buttons (shown by default) toggle under
  Options → Features
* Optional Stylus userstyle color-matching: when enabled, bundle colors are
  snapped to a detected Catppuccin theme's palette (Options → Advanced; off by
  default)

Learn more at [inbundly.com](https://inbundly.com).

## Screenshots

| Light | Dark |
|:---:|:---:|
| ![Inbundly bundling Gmail in light mode](docs/assets/screenshot-light.png) | ![Inbundly bundling Gmail in dark mode](docs/assets/screenshot-dark.png) |

## Setup

Inbundly uses webpack to bundle js files:

```bash
# Install dependencies
npm install

# Build with webpack to create dist/content.js
npm run build

# Rebuild automatically on every save (development)
npm run watch
```

The `dist` directory can then be loaded as an [unpacked extension](https://developer.chrome.com/extensions/getstarted).

### Testing

```bash
# Unit tests (Jest)
npm test

# End-to-end tests: the built extension against a Gmail-shaped fixture
# (one-time setup: npx playwright install chromium)
npm run test:e2e
```

[TESTING.md](TESTING.md) holds the full feature testing matrix. CI runs both
suites on every push and PR.

### Syncing settings between computers

Settings live in `chrome.storage.sync`, which only reaches installs that share one
extension ID. Unpacked builds normally get an ID derived from the folder they're loaded
from, so the same extension on two machines would get two IDs — and two separate,
never-syncing copies of your settings. `dist/manifest.json` therefore pins a `key`
(and a Firefox `browser_specific_settings.gecko.id`), which fixes the ID no matter
where `dist/` lives:

```
cpggdbckpaoikhddngoeepdedfkleiab
```

Options → **Sync & backup** shows the ID this install is actually using — it should
match on every computer. That section also exports/imports settings as JSON, which is
the way to move them when sync is off or when the ID changed. Chrome also needs
extension syncing enabled (`chrome://settings/syncSetup`), and propagation isn't
instant.

## Feedback

Feel free to [send feedback](https://github.com/benoror/inbundly/issues) by filing an issue,
or email [support@inbundly.com](mailto:support@inbundly.com).

## Support the project

Inbundly is free and open source. If it helps tidy your inbox, consider
[sponsoring its development](https://github.com/sponsors/benoror) ♥ — it keeps the
project maintained and the lights on.

[![Sponsor](https://img.shields.io/badge/Sponsor-♥-db61a2?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/benoror)

## Acknowledgements

* [material.io](https://material.io/resources/icons/): Icons in [dist/assets/](https://github.com/benoror/inbundly/tree/master/dist/assets/), [dist/options/assets/](https://github.com/benoror/inbundly/tree/master/dist/options/assets/), and [dist/popup/assets/](https://github.com/benoror/inbundly/tree/master/dist/popup/assets/) are modified versions of icons from material.io. The original material.io icons are licensed under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html).

## License

[GPL-3.0](https://github.com/benoror/inbundly/blob/master/COPYING). Copyright (C) 2020 [Teresa Ou](https://github.com/teresa-ou); modifications Copyright (C) 2026 [Ben Orozco](https://github.com/benoror). See [`NOTICE.md`](NOTICE.md).
