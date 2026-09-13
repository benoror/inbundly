// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Collapsed-row glance (TESTING.md §14): the newest thread's last sender and
// date on the closed bundle row, issue #56.

const { test, expect } = require('@playwright/test');
const { inboxPage, dateTitle } = require('./fixture/inbox');
const { launchWithExtension, serveInbox, openInbox } = require('./helpers/gmail');

let context;
let cleanup;

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            // Work: the newest thread is unread and from Jane; Bob's is older.
            { sender: 'Jane Doe', email: 'jane@acme.com', subject: 'Q3 numbers', labels: ['Work'], daysAgo: 0, unread: true },
            { sender: 'Bob', email: 'bob@acme.com', subject: 'Standup notes', labels: ['Work'], daysAgo: 3 },
            // News: both read, the newest is ten days old.
            { sender: 'Weekly Digest', email: 'digest@news.example', subject: 'Issue 41', labels: ['News'], daysAgo: 10 },
            { sender: 'Weekly Digest', email: 'digest@news.example', subject: 'Issue 40', labels: ['News'], daysAgo: 17 },
        ],
    }));
});

test.afterAll(async () => {
    await cleanup();
});

const bundle = (page, title) => page.locator('.bundle-row', { hasText: title });

test('the collapsed row shows the newest thread\'s last sender next to its date', async () => {
    const page = await openInbox(context);

    const news = bundle(page, 'News');
    await expect(news.locator('.bundle-latest-sender')).toHaveText('Weekly Digest');
    await expect(news.locator('.bundle-latest-sender')).toHaveAttribute('title', 'digest@news.example');
    await expect(news.locator('.bundle-date')).toHaveText(
        new Date(Date.now() - 10 * 86400000).toLocaleString('en-US', { month: 'short', day: 'numeric' }));
    // Gmail's own full-date tooltip travels with the date.
    await expect(news.locator('.bundle-date')).toHaveAttribute('title', dateTitle(10));
    // Read thread: the glance is not bold.
    await expect(news.locator('.bundle-latest-sender')).not.toHaveClass(/unread/);
    await expect(news.locator('.bundle-date')).not.toHaveClass(/unread/);
    // The senders peek still lists everyone, most recent first.
    await expect(news.locator('.bundle-senders')).toHaveText(/^\s*Weekly Digest\s*$/);

    await page.close();
});

test('an unread newest thread makes the sender and date bold, like Gmail\'s unread rows', async () => {
    const page = await openInbox(context);

    const work = bundle(page, 'Work');
    await expect(work.locator('.bundle-latest-sender')).toHaveText('Jane Doe');
    await expect(work.locator('.bundle-latest-sender')).toHaveClass(/unread/);
    await expect(work.locator('.bundle-date')).toHaveText('10:00 AM');
    await expect(work.locator('.bundle-date')).toHaveClass(/unread/);
    // The glance names the newest thread's sender first in the peek too.
    await expect(work.locator('.bundle-senders')).toHaveText(/^\s*Jane Doe,\s*Bob\s*$/);

    const sender = work.locator('.bundle-latest-sender');
    expect(await sender.evaluate(el => getComputedStyle(el).fontWeight)).toMatch(/^(bold|700)$/);

    await page.close();
});

test('the glance is a closed-row affordance: it hides while the bundle is open', async () => {
    const page = await openInbox(context);

    const work = bundle(page, 'Work');
    await work.click();
    await expect(page.locator('.bundled-message.visible')).toHaveCount(2);
    await expect(work.locator('.bundle-latest-sender')).toBeHidden();
    await expect(work.locator('.bundle-date')).toBeHidden();

    await work.click();
    await expect(work.locator('.bundle-latest-sender')).toBeVisible();
    await expect(work.locator('.bundle-date')).toBeVisible();

    await page.close();
});
