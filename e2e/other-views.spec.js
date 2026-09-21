// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Bundles outside the Inbox (#43; TESTING.md section 13): search results,
// label views, Snoozed, behind the bundleOtherViews option. The fixture is
// the same list for every view; the URL hash decides which view the
// extension believes it is on, as in Gmail.

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const {
    launchWithExtension,
    serveInbox,
    openInbox,
    openView,
    viewUrl,
    setSyncOptions,
} = require('./helpers/gmail');

// Tests flip a persisted option; run them in order on one browser.
test.describe.configure({ mode: 'serial' });

const THREAD_ID = 'FMfcgzQbfVjhKLmnpQrsTuvWxyz';

let context;
let cleanup;

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    // Outside the Inbox, Gmail shows the Inbox chip on inbox threads, so the
    // fixture carries it: it must never become a bundle.
    await serveInbox(context, inboxPage({
        tab: null,
        threads: [
            { email: 'a@corp-one.com', subject: 'Work update 1', labels: ['Inbox', 'Work'] },
            { email: 'b@corp-two.com', subject: 'Work update 2', labels: ['Inbox', 'Work'], unread: true },
            { email: 'c@corp-three.com', subject: 'Urgent work A', labels: ['Inbox', 'Work', 'Urgent'] },
            { email: 'd@corp-four.com', subject: 'Urgent work B', labels: ['Inbox', 'Work', 'Urgent'] },
            { email: 'x@acme.com', subject: 'Acme 1', labels: ['Inbox'] },
            { email: 'y@acme.com', subject: 'Acme 2', labels: ['Inbox'], daysAgo: 3 },
            { email: 'f@corp-six.com', subject: 'Just a message', daysAgo: 40 },
        ],
    }));
});

test.afterAll(async () => {
    await cleanup();
});

const bundleTitles = page => page.locator('.bundle-row .bundle-and-count > span:first-child')
    .allInnerTexts();

test('13.1 off by default: a search results page is left a plain Gmail list', async () => {
    const page = await openView(context, 'search/newsletters', { expectBundles: null });
    await expect(page.locator('.bundle-row')).toHaveCount(0);
    await page.close();
});

test('13.1 the Inbox bundles regardless of the option', async () => {
    const page = await openInbox(context);
    expect(await bundleTitles(page)).toEqual(expect.arrayContaining(['Work', 'acme.com']));
    await page.close();
});

test('13.2 turning the option on live rebundles the search the user is looking at', async () => {
    const page = await openView(context, 'search/newsletters', { expectBundles: null });

    await setSyncOptions(context, { bundleOtherViews: true });

    // The extension asks Gmail to refresh, Gmail repaints, the repaint bundles.
    await expect(page.locator('.bundle-row')).not.toHaveCount(0);
    expect(await page.evaluate(() => window.__gmail.refreshes)).toBe(1);
    await page.close();
});

test('13.3 search results bundle by label and sender; the Inbox chip is not a bundle', async () => {
    const page = await openView(context, 'search/newsletters');

    const titles = await bundleTitles(page);
    expect(titles).toHaveLength(3);
    expect(titles).toEqual(expect.arrayContaining(['Work', 'acme.com']));
    expect(titles.find(t => t.includes('Urgent'))).toBeTruthy();
    expect(titles).not.toContain('Inbox');
    expect(titles.some(t => t.includes('Inbox'))).toBe(false);
    await expect(page.locator('.bundled-message')).toHaveCount(6);
    // The lone unlabeled thread stays a plain row.
    await expect(page.locator('tr.zA', { hasText: 'Just a message' })).not.toHaveClass(/bundled-message/);

    // Bundles open and close here like in the Inbox.
    const work = page.locator('.bundle-row', { hasText: 'Work' })
        .filter({ hasNot: page.locator('text=Urgent') });
    await work.click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(2);
    await work.click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(0);

    // View all keeps the user inside the same search.
    const urgent = page.locator('.bundle-row', { hasText: 'Urgent' });
    await expect(urgent.locator('.view-all-link'))
        .toHaveAttribute('href', /#search\/newsletters\+label%3AWork\+label%3AUrgent$/);

    await page.close();
});

test('13.4 a label view does not bundle by the label it shows', async () => {
    const page = await openView(context, 'label/Work');

    const titles = await bundleTitles(page);
    // Work is what the view is: the Work-only threads become plain rows (one
    // per sender domain, so no sender bundle either), the Work+Urgent threads
    // group by Urgent, and the unlabeled Acme threads by sender.
    expect(titles.sort()).toEqual(['Urgent', 'acme.com']);
    await expect(page.locator('tr.zA', { hasText: 'Work update 1' })).not.toHaveClass(/bundled-message/);
    await expect(page.locator('tr.zA', { hasText: 'Work update 2' })).not.toHaveClass(/bundled-message/);

    await expect(page.locator('.bundle-row', { hasText: 'Urgent' }).locator('.view-all-link'))
        .toHaveAttribute('href', /#search\/label%3AWork\+label%3AUrgent$/);
    await page.close();
});

test('13.4 a bundle\'s own View all search does not fold the results back into one bundle', async () => {
    const page = await openView(context, 'search/label%3AInbox+label%3AWork');

    const titles = await bundleTitles(page);
    expect(titles.sort()).toEqual(['Urgent', 'acme.com']);
    await expect(page.locator('.bundle-row', { hasText: 'Urgent' }).locator('.view-all-link'))
        .toHaveAttribute('href', /#search\/label%3AInbox\+label%3AWork\+label%3AUrgent$/);
    await page.close();
});

test('13.4 a sender bundle\'s View all search does not re-bundle that sender', async () => {
    const page = await openView(context, 'search/label%3AInbox+from%3A%40acme.com');

    expect(await bundleTitles(page)).not.toContain('acme.com');
    await expect(page.locator('tr.zA', { hasText: 'Acme 1' })).not.toHaveClass(/bundled-message/);
    await page.close();
});

test('13.5 Snoozed bundles, with View all scoped to in:snoozed', async () => {
    const page = await openView(context, 'snoozed');

    expect(await bundleTitles(page)).toEqual(expect.arrayContaining(['Work', 'acme.com']));
    const work = page.locator('.bundle-row', { hasText: 'Work' })
        .filter({ hasNot: page.locator('text=Urgent') });
    await expect(work.locator('.view-all-link'))
        .toHaveAttribute('href', /#search\/in%3Asnoozed\+label%3AWork$/);
    await page.close();
});

test('13.6 the pinned page keeps its flat, date-grouped list', async () => {
    // Not bundled (no `.is-bundled` stamp): wait for the date dividers the
    // pinned page gets instead.
    const page = await context.newPage();
    await page.goto(viewUrl('search/is%3Astarred+label%3Ainbox'));
    await page.waitForSelector('.date-row', { timeout: 10000 });
    await expect(page.locator('.bundle-row')).toHaveCount(0);
    await page.close();
});

test('13.7 conversations, Sent, and Drafts are never touched', async () => {
    for (const hash of [`search/newsletters/${THREAD_ID}`, `inbox/${THREAD_ID}`, 'sent', 'drafts']) {
        const page = await openView(context, hash, { expectBundles: null });
        await page.close();
    }
});

test('13.2 turning the option off leaves the search plain again', async () => {
    const page = await openView(context, 'search/newsletters');

    await setSyncOptions(context, { bundleOtherViews: false });

    await expect(page.locator('.bundle-row')).toHaveCount(0);
    expect(await page.evaluate(() => window.__gmail.refreshes)).toBe(1);
    await page.close();
});
