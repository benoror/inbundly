// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Remember-the-open-bundle scenarios (TESTING.md §4), default options.

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const { launchWithExtension, serveInbox, openInbox } = require('./helpers/gmail');

const STORE_KEY = 'inbundly:openBundle:v1';

let context;
let cleanup;

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
            { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
            { email: 'c@corp-three.com', subject: 'News 1', labels: ['News'] },
            { email: 'd@corp-four.com', subject: 'News 2', labels: ['News'] },
        ],
    }));
});

test.afterAll(async () => {
    await cleanup();
});

async function storeValue(page) {
    return page.evaluate(key => sessionStorage.getItem(key), STORE_KEY);
}

test('the open bundle is remembered across a reload', async () => {
    const page = await openInbox(context);

    await page.locator('.bundle-row', { hasText: 'Work' }).click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(2);
    expect(JSON.parse(await storeValue(page))).toMatchObject({ label: 'Work' });

    await page.reload();
    await page.waitForSelector('.bundle-row.visible');
    await expect(page.locator('.bundle-row.visible')).toContainText('Work');
    await expect(page.locator('.bundled-message.visible')).toHaveCount(2);

    await page.close();
});

test('collapsing forgets the bundle; a reload keeps it closed', async () => {
    const page = await openInbox(context);

    const bundle = page.locator('.bundle-row', { hasText: 'News' });
    await bundle.click();
    await bundle.click();
    expect(await storeValue(page)).toBeNull();

    await page.reload();
    await page.waitForSelector('.is-bundled');
    await expect(page.locator('.bundle-row.visible')).toHaveCount(0);

    await page.close();
});

test('closing via the bundle area clears the memory too', async () => {
    const page = await openInbox(context);

    await page.locator('.bundle-row', { hasText: 'Work' }).click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(2);

    // Clicking the open-bundle backdrop is a user close.
    await page.locator('.bundle-area').dispatchEvent('click');
    await expect(page.locator('.bundled-message.visible')).toHaveCount(0);
    expect(await storeValue(page)).toBeNull();

    await page.close();
});
