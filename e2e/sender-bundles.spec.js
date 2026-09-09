// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Sender bundling scenarios (TESTING.md §3), default options.

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const { launchWithExtension, serveInbox, openInbox } = require('./helpers/gmail');

let context;
let cleanup;

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            // 3.1: two unlabeled threads from one corporate domain.
            { email: 'news@acme.com', sender: 'Acme News', subject: 'Newsletter 1' },
            { email: 'billing@acme.com', sender: 'Acme Billing', subject: 'Your invoice' },
            // 3.2: freemail groups by exact address.
            { email: 'jane@gmail.com', sender: 'Jane', subject: 'Hi 1' },
            { email: 'jane@gmail.com', sender: 'Jane', subject: 'Hi 2' },
            // 3.2/3.4: another freemail sender with one thread stays loose.
            { email: 'john@gmail.com', sender: 'John', subject: 'From John' },
            // 3.3: labeled threads never sender-bundle, whatever their domain.
            { email: 'team@initech.com', subject: 'Sprint 1', labels: ['Work'] },
            { email: 'team@initech.com', subject: 'Sprint 2', labels: ['Work'] },
            { email: 'extra@initech.com', subject: 'Loose initech mail' },
        ],
    }));
});

test.afterAll(async () => {
    await cleanup();
});

test('unlabeled threads from one domain bundle by domain', async () => {
    const page = await openInbox(context);

    const acme = page.locator('.bundle-row', { hasText: 'acme.com' });
    await expect(acme).toHaveCount(1);
    await expect(acme.locator('.bundle-count')).toHaveText('(2)');

    await page.close();
});

test('freemail senders group by exact address, one thread stays loose', async () => {
    const page = await openInbox(context);

    const jane = page.locator('.bundle-row', { hasText: 'jane@gmail.com' });
    await expect(jane).toHaveCount(1);
    await expect(jane.locator('.bundle-count')).toHaveText('(2)');

    // John's single gmail thread must not join Jane's bundle or form its own.
    await expect(page.locator('.bundle-row', { hasText: 'john@gmail.com' })).toHaveCount(0);
    await expect(page.locator('tr.zA', { hasText: 'From John' }))
        .not.toHaveClass(/bundled-message/);

    await page.close();
});

test('labeled threads bundle by label, never by sender', async () => {
    const page = await openInbox(context);

    // The two labeled initech threads form the Work bundle...
    const work = page.locator('.bundle-row', { hasText: 'Work' });
    await expect(work).toHaveCount(1);
    // ...and no initech.com sender bundle forms: the one unlabeled initech
    // thread is alone, so it stays a plain row.
    await expect(page.locator('.bundle-row', { hasText: 'initech.com' })).toHaveCount(0);
    await expect(page.locator('tr.zA', { hasText: 'Loose initech mail' }))
        .not.toHaveClass(/bundled-message/);

    await page.close();
});

test('view all searches by sender', async () => {
    const page = await openInbox(context);

    const acmeLink = page.locator('.bundle-row', { hasText: 'acme.com' })
        .locator('.view-all-link');
    await expect(acmeLink).toHaveAttribute('href', /from%3A%40acme\.com/);

    const janeLink = page.locator('.bundle-row', { hasText: 'jane@gmail.com' })
        .locator('.view-all-link');
    await expect(janeLink).toHaveAttribute('href', /from%3Ajane%40gmail\.com/);

    await page.close();
});

test('sender bundles render uncolored', async () => {
    const page = await openInbox(context);

    const acme = page.locator('.bundle-row', { hasText: 'acme.com' });
    await expect(acme).not.toHaveClass(/label-colored/);

    await page.close();
});
