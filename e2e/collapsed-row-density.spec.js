// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Collapsed bundle row height (TESTING.md 1.12): a long label name truncates
// with an ellipsis and the row keeps Gmail's own row height, so it follows
// Gmail's density setting. Based on https://github.com/semeon/inboxy-nuevo.

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const { launchWithExtension, serveInbox, openInbox } = require('./helpers/gmail');

const LONG = 'Receipts and invoices from every online store I ever bought from';

let context;
let cleanup;

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            { sender: 'Shop', email: 'orders@shop.example', subject: 'Order 1', labels: [LONG], daysAgo: 0 },
            { sender: 'Shop', email: 'orders@shop.example', subject: 'Order 2', labels: [LONG], daysAgo: 1 },
            { sender: 'Alice', email: 'alice@example.com', subject: 'Lunch?', labels: [], daysAgo: 0 },
        ],
        // Gmail lays rows and cells out as flex boxes with a fixed cell
        // height and let the row size to it; that cell height is what
        // `height: unset` used to override.
        head: '<style>tr.zA { display: flex; align-items: center; height: auto; }'
            + ' tr.zA > td { display: flex; align-items: center; height: 20px; }</style>',
    }));
});

test.afterAll(async () => {
    await cleanup();
});

test('a long label name ellipsizes and the collapsed bundle row is as tall as a thread row', async () => {
    const page = await openInbox(context);

    const bundleRow = page.locator('.bundle-row', { hasText: 'Receipts' });
    const plainRow = page.locator('tr.zA:not(.bundle-row)', { hasText: 'Lunch?' });
    await expect(bundleRow).toBeVisible();
    await expect(plainRow).toBeVisible();

    const title = bundleRow.locator('.bundle-and-count');
    const box = await title.evaluate(el => {
        const style = getComputedStyle(el);
        return {
            whiteSpace: style.whiteSpace,
            textOverflow: style.textOverflow,
            truncated: el.scrollWidth > el.clientWidth,
            lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5,
            height: el.getBoundingClientRect().height,
        };
    });
    expect(box.whiteSpace).toBe('nowrap');
    expect(box.textOverflow).toBe('ellipsis');
    expect(box.truncated).toBe(true);
    // One line, not wrapped onto a second.
    expect(box.height).toBeLessThan(box.lineHeight * 1.6);

    const bundleHeight = (await bundleRow.boundingBox()).height;
    const plainHeight = (await plainRow.boundingBox()).height;
    expect(Math.abs(bundleHeight - plainHeight)).toBeLessThanOrEqual(1);

    await page.close();
});
