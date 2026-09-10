// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Bundle action scenarios: select-all, archive, snooze, delete, disable
// rules, and a live option flip (TESTING.md §5, §10.4).

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

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({
        threads: [
            { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
            { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
            { email: 'c@corp-three.com', subject: 'Outside message' },
        ],
    }));
});

test.afterAll(async () => {
    await cleanup();
});

function workBundle(page) {
    return page.locator('.bundle-row', { hasText: 'Work' });
}

// Toggle a native (fixture) row checkbox the synthetic way, like the
// extension does — a real click would go through Gmail's quick-select
// handling, which is not what these scenarios exercise.
async function toggleRowCheckbox(page, subjectText) {
    await page.evaluate(text => {
        const row = [...document.querySelectorAll('tr.zA')]
            .find(r => r.textContent.includes(text) && !r.classList.contains('bundle-row'));
        row.querySelector('.oZ-jc').click();
    }, subjectText);
}

test('the bundle checkbox selects and deselects every message', async () => {
    const page = await openInbox(context);
    const checkbox = workBundle(page).locator('.bundle-checkbox');

    await checkbox.dispatchEvent('click');
    await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
    // Gmail's toolbar action cluster is revealed by the selection.
    await expect(page.locator('.G-Ni')).toBeVisible();
    // The styler reflects the full selection on the bundle checkbox and gives
    // the bundle row Gmail's selected styling.
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
    await expect(workBundle(page)).toHaveClass(/x7/);

    await checkbox.dispatchEvent('click');
    await expect(page.locator('tr.zA.x7')).toHaveCount(0);
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await page.close();
});

test('a partial selection shows the indeterminate state', async () => {
    const page = await openInbox(context);

    await toggleRowCheckbox(page, 'Work 1');
    await expect(workBundle(page).locator('.bundle-checkbox'))
        .toHaveAttribute('aria-checked', 'mixed');

    await page.close();
});

test('bundle snooze selects the messages and clicks the toolbar snooze', async () => {
    const page = await openInbox(context);

    await workBundle(page).locator('.snooze-bundle').dispatchEvent('click');

    await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => window.__gmail.clicks))
        .toContain('Snooze');

    await page.close();
});

test('bundle archive-all clicks the toolbar archive', async () => {
    const page = await openInbox(context);

    await workBundle(page).locator('.archive-bundle').dispatchEvent('click');

    await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => window.__gmail.clicks))
        .toContain('act:7');

    await page.close();
});

test('showBundleDelete is off by default and flips live', async () => {
    const page = await openInbox(context);

    await expect(page.locator('html')).toHaveClass(/hide-bundle-delete/);

    await setSyncOptions(context, { showBundleDelete: true });
    await expect(page.locator('html')).not.toHaveClass(/hide-bundle-delete/);

    await setSyncOptions(context, { showBundleDelete: false });
    await expect(page.locator('html')).toHaveClass(/hide-bundle-delete/);

    await page.close();
});

test('bundle delete-all clicks the toolbar delete', async () => {
    const page = await openInbox(context);

    // Delete-all is off by default; enable it so the control is live.
    await setSyncOptions(context, { showBundleDelete: true });
    await expect(page.locator('html')).not.toHaveClass(/hide-bundle-delete/);

    await workBundle(page).locator('.delete-bundle').dispatchEvent('click');

    await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => window.__gmail.clicks))
        .toContain('Delete');

    await setSyncOptions(context, { showBundleDelete: false });
    await page.close();
});

test('selecting a message outside the bundle disables its actions', async () => {
    const page = await openInbox(context);

    await toggleRowCheckbox(page, 'Outside message');

    const bundle = workBundle(page);
    await expect(bundle.locator('.snooze-bundle')).toHaveClass(/disabled/);
    await expect(bundle.locator('.archive-bundle')).toHaveClass(/disabled/);
    await expect(bundle.locator('.delete-bundle')).toHaveClass(/disabled/);

    // A disabled snooze must not reach the toolbar.
    await bundle.locator('.snooze-bundle').dispatchEvent('click');
    expect(await page.evaluate(() => window.__gmail.clicks)).toEqual([]);

    await page.close();
});

test('flipping showBundleSnooze in storage hides the button live', async () => {
    const page = await openInbox(context);

    await setSyncOptions(context, { showBundleSnooze: false });
    await expect(page.locator('html')).toHaveClass(/hide-bundle-snooze/);

    await setSyncOptions(context, { showBundleSnooze: true });
    await expect(page.locator('html')).not.toHaveClass(/hide-bundle-snooze/);

    await page.close();
});
