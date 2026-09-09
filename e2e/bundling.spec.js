// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Core bundling scenarios (TESTING.md §1, §2, §7), default options.

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const { launchWithExtension, serveInbox, openInbox } = require('./helpers/gmail');

let context;
let cleanup;

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            // 1.1: two threads sharing a label -> one bundle.
            { email: 'a@corp-one.com', subject: 'Work update 1', labels: ['Work'], daysAgo: 0 },
            { email: 'b@corp-two.com', subject: 'Work update 2', labels: ['Work'], daysAgo: 0, unread: true },
            // 2.5: a distinct label *set* forms its own bundle.
            { email: 'c@corp-three.com', subject: 'Urgent work A', labels: ['Work', 'Urgent'], daysAgo: 0 },
            { email: 'd@corp-four.com', subject: 'Urgent work B', labels: ['Work', 'Urgent'], daysAgo: 0 },
            // 2.7: a label with one thread stays a plain row.
            { email: 'e@corp-five.com', subject: 'Lone receipt', labels: ['Receipts'], daysAgo: 0 },
            // 1.5: an unbundled plain row (unique sender domain, no label).
            { email: 'f@corp-six.com', subject: 'Just a message', daysAgo: 40 },
        ],
    }));
});

test.afterAll(async () => {
    await cleanup();
});

test('threads sharing a label bundle into one row', async () => {
    const page = await openInbox(context);

    const workBundle = page.locator('.bundle-row', { hasText: 'Work' })
        .filter({ hasNot: page.locator('text=Urgent') });
    await expect(workBundle).toHaveCount(1);
    await expect(workBundle.locator('.bundle-count')).toHaveText('(2)');
    // Senders preview shows the members' names.
    await expect(workBundle.locator('.bundle-senders')).toContainText('a');
    // Its messages are marked and hidden behind the bundle.
    await expect(page.locator('.bundled-message')).toHaveCount(4);

    await page.close();
});

test('a distinct label set forms its own combined bundle', async () => {
    const page = await openInbox(context);

    const combined = page.locator('.bundle-row', { hasText: 'Urgent' });
    await expect(combined).toHaveCount(1);
    await expect(combined.locator('.bundle-count')).toHaveText('(2)');
    await expect(combined.locator('.bundle-and-count')).toContainText('Work');

    await page.close();
});

test('clicking a bundle expands it in place; clicking again collapses', async () => {
    const page = await openInbox(context);

    const bundle = page.locator('.bundle-row', { hasText: 'Urgent' });
    await bundle.click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(2);

    await bundle.click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(0);

    await page.close();
});

test('single-thread labels and unlabeled one-offs stay plain rows', async () => {
    const page = await openInbox(context);

    // No bundle formed for the 1-thread label or the loose sender.
    await expect(page.locator('.bundle-row', { hasText: 'Receipts' })).toHaveCount(0);
    const lone = page.locator('tr.zA', { hasText: 'Lone receipt' });
    await expect(lone).not.toHaveClass(/bundled-message/);
    const loose = page.locator('tr.zA', { hasText: 'Just a message' });
    await expect(loose).not.toHaveClass(/bundled-message/);

    await page.close();
});

test('date dividers group the single-section inbox', async () => {
    const page = await openInbox(context);

    // Mixed thread ages (today + ~40 days ago) yield at least two dividers.
    expect(await page.locator('.date-row').count()).toBeGreaterThanOrEqual(2);

    await page.close();
});
