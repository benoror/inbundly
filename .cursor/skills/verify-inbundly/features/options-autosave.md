# Options autosave and live sync

The Options page has no Save button: every control writes its own key to
`chrome.storage.sync` the moment it changes and shows a brief `Saved` status. Because the
content script listens to the same storage area, an open Gmail tab picks the change up
live, without a reload, and so does any other device signed into the same browser account.
The page shows the pinned extension id that this sync depends on.

## Sub-features

- `options-load` the page opens at
  `chrome-extension://cpggdbckpaoikhddngoeepdedfkleiab/options/options.html`, shows that
  id in `#extension-id`, and reflects defaults (delete-all switch off).
- `options-autosave-key` flipping one switch writes exactly that key (nothing else) to
  sync storage and shows `#save-status` as visible.
- `options-live-gmail` the Gmail tab reacts live: `showBundleDelete` on removes
  `hide-bundle-delete` from `<html>`; off restores it.
- `options-persist` reloading the Options page shows the saved state.

## How to get to it (user POV)

- Click the Inbundly toolbar icon, then `Options`; or `chrome://extensions`, Inbundly,
  `Extension options`.
- Flip any switch (for example `Show the delete-all button on bundles`); the `Saved` check
  appears, and the Gmail tab updates without reloading.
- Sync and backup, at the bottom, exports or imports the same settings as JSON.

## Driving it with Playwright

Preconditions:

- `scripts/verify.sh doctor` passed for the current `RUN_ID`.
- Fixture inbox threads: `Work 1` and `Work 2` (label `Work`). This is the
  `options-autosave` seed in `scripts/drive.js`.
- Fresh profile, so `chrome.storage.sync.get(null)` (evaluated in the extension's service
  worker, `context.serviceWorkers()[0]`) returns `{}` at the start.
- `const deleteSwitch = options.locator('label.switch:has(#show-bundle-delete-checkbox) .slider')`.

- **Run the mapped drive.** `.cursor/skills/verify-inbundly/scripts/verify.sh drive options-autosave`.
  Four walk steps `PASS`, `e2e/bundle-actions.spec.js -g "flips live|in storage"` reports
  `2 passed`, and `npx jest test/OptionsPage.test.js test/Options.test.js` passes;
  `evidence/<RUN_ID>/options-autosave/RESULT` reads `PASS`.
- **Open both pages.** `const inbox = await openInbox(context)` then
  `const options = await context.newPage(); await options.goto(optionsUrl)`.
  `options.locator('#extension-id')` reads `cpggdbckpaoikhddngoeepdedfkleiab`,
  `#show-bundle-delete-checkbox` is unchecked, `inbox.locator('html')` has class
  `hide-bundle-delete`, and sync storage is `{}`.
- **Flip on.** `await deleteSwitch.click()`. `#show-bundle-delete-checkbox` is checked,
  `#save-status` has class `visible`, sync storage equals `{ showBundleDelete: true }`,
  and the inbox `<html>` loses `hide-bundle-delete` (wait with `inbox.waitForFunction`).
- **Persist.** `await options.reload()`. The switch is still checked.
- **Flip off.** `await deleteSwitch.click()`. Sync storage equals
  `{ showBundleDelete: false }` and the inbox `<html>` has `hide-bundle-delete` again.
- **Proof.** `evidence/<RUN_ID>/options-autosave/02-flip-delete-all-on-options.png` shows
  the switch on with the `Saved` status, and `02-flip-delete-all-on-inbox.png` the Gmail
  tab in the same instant; `walk.md` records the storage contents after each flip.

## Gotchas

- The real `<input type="checkbox">` is visually hidden behind the styled `.slider`;
  `locator.check()` on the input times out. Click the slider inside the same
  `label.switch`.
- `TESTING.md` says the Options page is manual because branded Chrome blocks automation on
  `chrome-extension://` pages. That is true for a human's Chrome; Playwright's Chromium
  with the unpacked extension does load and script it, which is what this recipe relies
  on.
- The Options URL uses the pinned extension id. If `#extension-id` shows anything else,
  `dist/manifest.json` `key` changed and every stored setting is unreachable; stop and
  report rather than driving on.
- Read storage through the service worker, not the Options page, so the check is a
  second, independent view of the saved value.
- List textareas (label lists, priority rules) debounce before saving; if you extend the
  walk to them, wait for `#save-status.visible` rather than reading storage immediately.
