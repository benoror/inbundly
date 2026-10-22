// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2026  Ben Orozco

// Browser plumbing for the marketing renders: the real built extension
// (dist/) in Chromium, the e2e fixture served at mail.google.com, and
// chrome.storage.sync set through the extension's service worker, the same
// harness the e2e suite uses (e2e/helpers/gmail.js).

const { chromium } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { inboxPage } = require('../../e2e/fixture/inbox');
const { standIn } = require('./standin');
const { rowsFor, NAV_LABELS } = require('./data');

const DIST = path.resolve(__dirname, '..', '..', 'dist');
const GMAIL_URL = 'https://mail.google.com/mail/u/0/';

// The v4.5.0 defaults plus the plan's global render settings (section 5).
const RENDER_OPTIONS = {
    bundlingEnabled: true,
    bundleOtherViews: false,
    colorBundlesByLabel: true,
    bundleColorStyle: 'accent',
    senderBundling: true,
    combineLabels: true,
    keepStarredUnbundled: true,
    skipStarredOnArchive: false,
    groupMessagesByDate: true,
    showBundleArchive: true,
    showBundleSnooze: true,
    showBundleDelete: false,
    // Judgment call (see README): the plan's S1 to S4 show one "Work (4)"
    // bundle, but with "Bundle label combinations" on, the two threads also
    // labeled Work/Clients form their own "Work + Clients" bundle. A real
    // priority rule (Options > Advanced bundle rules) keeps Work together.
    priorityBundles: ['Work'],
};

async function launch({ viewport, colorScheme = 'light', deviceScaleFactor = 2 }) {
    if (!fs.existsSync(path.join(DIST, 'content.js'))) {
        throw new Error('dist/content.js missing: run `npm run build` first');
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbundly-render-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium',
        viewport,
        deviceScaleFactor,
        colorScheme,
        reducedMotion: 'reduce',
        args: [
            `--disable-extensions-except=${DIST}`,
            `--load-extension=${DIST}`,
            '--hide-scrollbars',
            '--font-render-hinting=none',
        ],
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) {
        worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    const extensionId = await worker.evaluate(() => chrome.runtime.id);
    const close = async () => {
        await context.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    };
    const setOptions = options => worker.evaluate(
        opts => new Promise(resolve => chrome.storage.sync.set(opts, resolve)), options);
    const clearOptions = () => worker.evaluate(
        () => new Promise(resolve => chrome.storage.sync.clear(resolve)));
    return { context, worker, extensionId, close, setOptions, clearOptions };
}

/** Local midnight of the render day. */
function renderDay() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Serve a scene's inbox and open it at `hash`. Waits for the extension's
 * first pass and for webfonts.
 */
async function openScene(env, {
    entries,
    theme = 'light',
    nav = true,
    search = '',
    hash = 'inbox',
    expect = 'bundles',
    transparent = false,
    archiveRemovesRows = false,
    inboxCount = '3',
}) {
    const { context } = env;
    const html = inboxPage({
        threads: rowsFor(entries, renderDay()),
        archiveRemovesRows,
        ...standIn({ theme, nav, search, labels: NAV_LABELS, inboxCount, transparent }),
    });
    await context.unroute('https://mail.google.com/**').catch(() => {});
    await context.route('https://mail.google.com/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const page = await context.newPage();
    await page.goto(GMAIL_URL + '#' + hash);
    if (expect === 'bundles') {
        await page.waitForSelector('.bundle-row', { timeout: 15000 });
    }
    else {
        await page.waitForSelector('html.inbundly', { timeout: 15000 });
    }
    await page.evaluate(() => document.fonts.ready);
    await settle(page);
    return page;
}

/** Let the extension's passes and repaints finish. */
async function settle(page, ms = 600) {
    await page.waitForTimeout(ms);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Click the collapsed bundle row whose title starts with `title`. */
async function openBundle(page, title) {
    const row = bundleRow(page, title);
    await row.click({ position: { x: 240, y: 20 } });
    await settle(page, 400);
    // Park the mouse off the list so no hover state lingers.
    await page.mouse.move(2, 2);
    await page.evaluate(() => {
        const c = document.getElementById('render-cursor');
        if (c) { c.style.display = 'none'; }
    });
    await settle(page, 200);
}

function bundleRow(page, title) {
    return page.locator('tr.bundle-row').filter({
        has: page.locator('.bundle-and-count span:first-child', { hasText: new RegExp('^' + escapeRe(title) + '$') }),
    }).first();
}

function threadRowLocator(page, subject) {
    return page.locator('tr.zA:not(.bundle-row)').filter({
        has: page.locator('.y6', { hasText: subject }),
    }).first();
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Show or hide the drawn mouse pointer. */
async function setCursorVisible(page, visible) {
    await page.evaluate(v => {
        if (window.__renderCursor) { window.__renderCursor.show = v; }
        const c = document.getElementById('render-cursor');
        if (c && !v) { c.style.display = 'none'; }
    }, visible);
}

module.exports = {
    RENDER_OPTIONS,
    launch,
    openScene,
    settle,
    openBundle,
    bundleRow,
    threadRowLocator,
    setCursorVisible,
    renderDay,
};
