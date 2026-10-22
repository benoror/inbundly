# Store and site renders

Renders the v4.5.0 store screenshots, the Options-page clips, and the raw
frames for the hero and tile art. It follows "Render spec for Lucca" in the
visuals plan.

```bash
npm run render:assets      # build dist/, render everything, check every file
npm run render:check       # re-run only the checks
node marketing/render/render.js --only s1,c2 --out /tmp/assets
```

Output goes to `/workspace/inbundly-store-assets/` (or `--out` /
`RENDER_OUT`). It stays outside the repo, and none of this is in `dist/`, so the
shipped extension is unchanged.

## How it works

- The **real build** (`dist/`) runs in Chromium on the e2e fixture
  (`e2e/fixture/inbox.js`), which is served at mail.google.com, the same way
  the e2e suite runs. Every bundle row, date heading, glance, button and switch
  comes from the extension.
- `standin.js` dresses the fixture as a stand-in Gmail: top bar, navigation,
  the rounded pane, and row cells, checkboxes, stars and chips. It uses no
  Gmail or Google logos and no Google app icons. The wordmark reads "Mail" and
  the avatar is a generic initial.
- `data.js` holds the invented data set from the plan, which was name-checked
  on 2026-10-21. The rows marked `extra` reuse the plan's senders and domains
  for shots that need more threads than the plan's table has.
- Settings are written to `chrome.storage.sync` through the extension's
  service worker. Stills are captured at DPR 2 and downscaled with Lanczos to
  sRGB PNGs, with no color profile and no alpha.
- Clips are a deterministic sequence of screenshots: real mouse input (so
  hover is real) and real clicks, encoded with ffmpeg to VP9 WebM, plus an
  H.264 MP4 and a poster PNG. C3 and C4 run the Options page and the inbox as
  two tabs in one browser, and the switch updates the inbox through sync
  storage. Each clip ends on its first frame. C2 ends in a 0.4 s crossfade,
  because archiving can't be undone on screen.
- `check.js` verifies pixel sizes, file sizes, alpha and ICC, codecs, clip
  lengths, the loop point, and the 1.2 MB WebM budget.

## Fixture extension points

These are off by default, so the e2e suite sees the page it always had:
- `threadRow`: `snippet`, `labelColors`, `dateText`, `dateTitle`.
- `inboxPage`: `head`, `wrapBefore`, `wrapAfter`, `bodyEnd`, and
  `archiveRemovesRows` (Archive takes the rows out and repaints the list, as
  Gmail does).

## Known limits

- Content scripts run in an isolated world, which Playwright's clock can't
  freeze. Date headings follow the day of the render, and the data is anchored
  to that day. Rendering on 2026-10-21 matches the plan's frozen clock.
- Headless Chromium paints neither native `title` tooltips nor a mouse
  pointer. The pointer is drawn as an overlay that follows real mouse events.
  Tooltips are not shown.
