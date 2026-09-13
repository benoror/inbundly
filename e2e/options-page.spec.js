// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// The Options page itself, driven in Chromium with the unpacked extension:
// sections by topic, jump links, defaults on the page, find a setting, and
// the per-key auto-save behind a real switch click (TESTING.md section 16;
// issue #57).

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const {
    launchWithExtension,
    serveInbox,
    openInbox,
    setSyncOptions,
} = require('./helpers/gmail');

let context;
let cleanup;
let optionsUrl;

const SECTIONS = [
    'bundling',
    'labels',
    'inbox-layout',
    'pinned-messages',
    'bundle-actions',
    'appearance',
    'custom-bundles',
    'sync-backup',
];

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
            { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
        ],
    }));
    // The service worker only spins up once a page loads the extension.
    const inbox = await openInbox(context);
    const worker = context.serviceWorkers()[0]
        || await context.waitForEvent('serviceworker', { timeout: 10000 });
    const id = await worker.evaluate(() => chrome.runtime.id);
    optionsUrl = `chrome-extension://${id}/options/options.html`;
    await inbox.close();
});

test.afterAll(async () => {
    await cleanup();
});

// Each test starts from an empty sync store, as a fresh profile would.
test.afterEach(async () => {
    const worker = context.serviceWorkers()[0];
    await worker.evaluate(() => new Promise(resolve => chrome.storage.sync.clear(resolve)));
});

async function openOptions(hash = '') {
    const page = await context.newPage();
    await page.goto(optionsUrl + hash);
    await page.locator('#bundling-enabled-checkbox').waitFor({ state: 'attached' });
    return page;
}

const storedSync = async () => {
    const worker = context.serviceWorkers()[0];
    return worker.evaluate(() => new Promise(resolve => chrome.storage.sync.get(null, resolve)));
};

const visibleSections = page => page.locator('.option-category:not(.search-hidden)')
    .evaluateAll(sections => sections.map(s => s.id));

test('the page opens on Options, grouped into named sections with jump links', async () => {
    const page = await openOptions();

    await expect(page).toHaveTitle('Inbundly - Options');
    await expect(page.locator('.tab.options')).toBeVisible();
    await expect(page.locator('.tab.get-started')).toBeHidden();

    expect(await visibleSections(page)).toEqual(SECTIONS);
    const links = await page.locator('.section-nav a').evaluateAll(
        anchors => anchors.map(a => a.getAttribute('href').slice(1)));
    expect(links).toEqual(SECTIONS);

    // The Bundle actions section holds the three buttons and the archive switches.
    const actionSwitches = await page.locator('#bundle-actions input[type="checkbox"]')
        .evaluateAll(inputs => inputs.map(i => i.id));
    expect(actionSwitches).toEqual([
        'show-bundle-archive-checkbox',
        'show-bundle-snooze-checkbox',
        'show-bundle-delete-checkbox',
        'skip-starred-on-archive-checkbox',
        'mark-read-on-archive-checkbox',
        'unstar-on-archive-checkbox',
    ]);
    await page.close();
});

test('a jump link scrolls to its section and the hash stays on the Options tab', async () => {
    const page = await openOptions();

    await page.locator('.section-nav a[href="#bundle-actions"]').click();
    await expect(page).toHaveURL(/#bundle-actions$/);
    await expect(page.locator('.tab.options')).toBeVisible();
    const top = await page.locator('#bundle-actions').evaluate(
        el => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(120);

    // A direct link to a section lands there too.
    const direct = await openOptions('#appearance');
    await expect(direct.locator('.tab.options')).toBeVisible();
    await expect(direct.locator('.nav-links a.active')).toHaveText('Options');
    await page.close();
    await direct.close();
});

test('each switch row says its default and marks a value that differs', async () => {
    const page = await openOptions();
    const deleteRow = page.locator('.option-row', { has: page.locator('#show-bundle-delete-checkbox') });

    await expect(deleteRow.locator('.option-default')).toHaveText('Default: off');
    await expect(deleteRow).not.toHaveClass(/differs/);

    await deleteRow.locator('label.switch .slider').click();
    await expect(page.locator('#show-bundle-delete-checkbox')).toBeChecked();
    await expect(deleteRow).toHaveClass(/differs/);
    await expect(page.locator('#save-status')).toHaveClass(/visible/);
    await expect.poll(storedSync).toEqual({ showBundleDelete: true });

    await deleteRow.locator('label.switch .slider').click();
    await expect(deleteRow).not.toHaveClass(/differs/);
    await expect.poll(storedSync).toEqual({ showBundleDelete: false });
    await page.close();
});

test('a changed setting inside an Advanced fold opens the fold on load', async () => {
    const page = await openOptions();
    await expect(page.locator('#label-rules')).not.toHaveAttribute('open', '');

    await setSyncOptions(context, { combineLabels: false });
    await page.reload();
    await page.locator('#combine-labels-checkbox').waitFor({ state: 'attached' });
    await expect.poll(() => page.locator('#label-rules').evaluate(d => d.open)).toBe(true);
    await expect(page.locator('#combine-labels-checkbox')).not.toBeChecked();
    await expect(page.locator('#combine-labels-checkbox').locator('xpath=ancestor::*[contains(@class,"option-row")]'))
        .toHaveClass(/differs/);
    await page.close();
});

test('find a setting narrows the page, opens folds, and clears back', async () => {
    const page = await openOptions();
    const search = page.locator('#options-search');

    await search.fill('priority');
    expect(await visibleSections(page)).toEqual(['labels']);
    await expect(page.locator('#label-rules')).toHaveAttribute('open', '');
    await expect(page.locator('#priority-bundles-list')).toBeVisible();
    await expect(page.locator('#combine-labels-checkbox')).toBeHidden();
    await expect(page.locator('.section-nav a[href="#appearance"]')).toHaveClass(/dimmed/);

    await search.fill('no such setting anywhere');
    expect(await visibleSections(page)).toEqual([]);
    await expect(page.locator('#options-no-matches')).toBeVisible();
    await expect(page.locator('#options-no-matches')).toContainText('no such setting anywhere');

    await search.press('Escape');
    await expect(search).toHaveValue('');
    expect(await visibleSections(page)).toEqual(SECTIONS);
    await expect(page.locator('#label-rules')).not.toHaveAttribute('open', '');
    await expect(page.locator('#options-no-matches')).toBeHidden();

    // "/" from the page body focuses the box.
    await page.locator('.tab.options h1').click();
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await page.close();
});
