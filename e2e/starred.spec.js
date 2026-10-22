// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Show starred on their own rows (keepStarredUnbundled, TESTING.md section 6).
// The fixture toggles a star in place, the way Gmail does: no list repaint.
// By default only the star's names (aria-label, data-tooltip, the img's alt)
// change and the class it was rendered with stays; 6.2 also runs with the
// fixture swapping the class, the older contract.

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

const THREADS = [
    { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
    { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
    { email: 'c@corp-three.com', subject: 'Work 3', labels: ['Work'] },
    { email: 'd@corp-four.com', subject: 'Work pinned', labels: ['Work'], starred: true },
    { email: 'e@corp-five.com', subject: 'Outside message' },
];

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({ threads: THREADS }));
});

// Serve the inbox again with the fixture's star click in `starToggle` mode.
async function serveWithToggle(starToggle) {
    await context.unroute('https://mail.google.com/**');
    await serveInbox(context, inboxPage({ threads: THREADS, starToggle }));
}

test.afterAll(async () => {
    await cleanup();
});

test.afterEach(async () => {
    await setSyncOptions(context, { keepStarredUnbundled: true });
});

const workBundle = page => page.locator('.bundle-row', { hasText: 'Work' });

function row(page, subject) {
    return page.locator('tr.zA:not(.bundle-row)', {
        has: page.locator('.y6 span span', { hasText: new RegExp(`^${subject}$`) }),
    });
}

// A user's star click: mousedown (StarHandler's scroll anchoring), then click,
// both on the star's img, which is what a click on Gmail's star hits.
async function clickStar(page, subject) {
    await page.evaluate(s => {
        const target = [...document.querySelectorAll('tr.zA:not(.bundle-row)')]
            .find(r => r.querySelector('.y6 span span').textContent === s);
        const img = target.querySelector('.T-KT img');
        img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        img.click();
    }, subject);
}

test('6.1 a starred thread starts outside its bundle', async () => {
    const page = await openInbox(context);
    await expect(workBundle(page).locator('.bundle-count')).toHaveText('(3)');
    await expect(row(page, 'Work pinned')).not.toHaveClass(/bundled-message/);
    await page.close();
});

for (const starToggle of ['attributes', 'class']) {
    test.describe(`star flips by ${starToggle}`, () => {
        test.beforeAll(() => serveWithToggle(starToggle));
        test.afterAll(() => serveWithToggle('attributes'));

        test('6.2 starring a thread inside an open bundle pops it out; the bundle stays open', async () => {
            const page = await openInbox(context);
            await workBundle(page).click();
            await expect(row(page, 'Work 2')).toHaveClass(/visible/);

            await clickStar(page, 'Work 2');

            await expect(workBundle(page).locator('.bundle-count')).toHaveText('(2)');
            await expect(row(page, 'Work 2')).not.toHaveClass(/bundled-message/);
            await expect(row(page, 'Work 2')).toBeVisible();
            await expect(workBundle(page)).toHaveClass(/visible/);
            await page.close();
        });

        test('6.2 unstarring a thread outside its bundle returns it to the bundle', async () => {
            const page = await openInbox(context);

            await clickStar(page, 'Work pinned');

            await expect(workBundle(page).locator('.bundle-count')).toHaveText('(4)');
            await expect(row(page, 'Work pinned')).toHaveClass(/bundled-message/);
            await page.close();
        });
    });
}

test('6.3 with the option off a star changes nothing about bundling', async () => {
    await setSyncOptions(context, { keepStarredUnbundled: false });
    const page = await openInbox(context);
    await expect(workBundle(page).locator('.bundle-count')).toHaveText('(4)');
    await workBundle(page).click();

    await clickStar(page, 'Work 2');
    await page.waitForTimeout(300);

    await expect(workBundle(page).locator('.bundle-count')).toHaveText('(4)');
    await expect(row(page, 'Work 2')).toHaveClass(/bundled-message/);
    await page.close();
});

test('6.2 a refresh after a star keeps the new layout', async () => {
    const page = await openInbox(context);
    await workBundle(page).click();
    await clickStar(page, 'Work 1');
    await expect(workBundle(page).locator('.bundle-count')).toHaveText('(2)');

    await page.locator('.G-atb .T-I[act="20"]').dispatchEvent('click');

    await expect(workBundle(page).locator('.bundle-count')).toHaveText('(2)');
    await expect(row(page, 'Work 1')).not.toHaveClass(/bundled-message/);
    await page.close();
});
