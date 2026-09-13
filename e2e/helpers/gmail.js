// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Playwright harness: load the built extension (dist/) into Chromium, then
// serve a Gmail-shaped fixture page at mail.google.com via route
// interception. The content script injects for real — same manifest, same
// selectors, same chrome.storage — everything except Google's servers.

const { chromium } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIST = path.resolve(__dirname, '..', '..', 'dist');
const GMAIL_URL = 'https://mail.google.com/mail/u/0/';
const INBOX_URL = `${GMAIL_URL}#inbox`;

/**
 * The URL of a Gmail list view by its hash, e.g. viewUrl('label/Work'),
 * viewUrl('search/label%3AInbox+label%3AWork'), viewUrl('snoozed').
 */
function viewUrl(hash) {
    return `${GMAIL_URL}#${hash}`;
}

/**
 * Launch Chromium with the unpacked extension. Returns { context, cleanup }.
 * Chromium (not branded Chrome) still supports --load-extension, and modern
 * headless supports extensions.
 */
async function launchWithExtension() {
    if (!fs.existsSync(path.join(DIST, 'content.js'))) {
        throw new Error('dist/content.js missing — run `npm run build` before the e2e suite');
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbundly-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${DIST}`,
            `--load-extension=${DIST}`,
        ],
    });
    const cleanup = async () => {
        await context.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    };
    return { context, cleanup };
}

/**
 * Serve `html` for every mail.google.com request in this context.
 */
async function serveInbox(context, html) {
    await context.route('https://mail.google.com/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html', body: html }));
}

/**
 * Open the fixture inbox and wait for the first bundling pass.
 * Pass `expectBundles: false` for scenarios where no bundle should form.
 */
async function openInbox(context, { expectBundles = true } = {}) {
    return openView(context, 'inbox', { expectBundles });
}

/**
 * Open the fixture at the list view named by `hash` (see viewUrl) and wait
 * for the extension to settle:
 *  - expectBundles true: until a bundle row is drawn;
 *  - expectBundles false: until the list is stamped as bundled without rows;
 *  - expectBundles null: the extension must leave the list alone. Waits for
 *    the content script to have run (it marks <html> at startup), then a
 *    grace period, and asserts nothing was injected.
 */
async function openView(context, hash, { expectBundles = true } = {}) {
    const page = await context.newPage();
    await page.goto(viewUrl(hash));
    if (expectBundles === null) {
        await page.waitForSelector('html.inbundly', { timeout: 10000 });
        await page.waitForTimeout(750);
        if (await page.locator('.bundle-row, .is-bundled, .date-row').count() !== 0) {
            throw new Error(`expected the extension to leave #${hash} alone`);
        }
    }
    else if (expectBundles) {
        await page.waitForSelector('.bundle-row', { timeout: 10000 });
    }
    else {
        // Bundling stamps the list wrapper even when it draws no bundle rows.
        await page.waitForSelector('.is-bundled', { timeout: 10000 });
    }
    return page;
}

/**
 * The extension's MV3 service worker (background.js). Evaluate in it to read
 * or write chrome.storage.sync, which live-syncs into the content script.
 */
async function extensionWorker(context) {
    const existing = context.serviceWorkers();
    if (existing.length) {
        return existing[0];
    }
    return context.waitForEvent('serviceworker', { timeout: 10000 });
}

async function setSyncOptions(context, options) {
    const worker = await extensionWorker(context);
    await worker.evaluate(
        opts => new Promise(resolve => chrome.storage.sync.set(opts, resolve)),
        options);
}

module.exports = {
    INBOX_URL,
    viewUrl,
    launchWithExtension,
    serveInbox,
    openInbox,
    openView,
    setSyncOptions,
};
