// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Keyboard navigation with bundles (TESTING.md §12): j/k treat bundle rows as
// stops, shortcuts act inside an open bundle, and the fallbacks for a Gmail
// whose cursor does not follow focus.

const { test, expect } = require('@playwright/test');
const { inboxPage } = require('./fixture/inbox');
const { launchWithExtension, serveInbox, openInbox } = require('./helpers/gmail');

// DOM (Gmail) order: Loose A, Work 1, Loose B, Work 2, News 1, News 2.
// Display order: Loose A, [Work], Loose B, [News].
const THREADS = [
    { email: 'a@corp-one.com', subject: 'Loose A' },
    { email: 'b@corp-two.com', subject: 'Work 1', labels: ['Work'] },
    { email: 'c@corp-three.com', subject: 'Loose B' },
    { email: 'd@corp-four.com', subject: 'Work 2', labels: ['Work'] },
    { email: 'e@corp-five.com', subject: 'News 1', labels: ['News'] },
    { email: 'f@corp-six.com', subject: 'News 2', labels: ['News'] },
];

/**
 * What the keyboard cursor is on: a message subject, a bundle's label, or
 * the focused element's tag when focus is outside the list.
 */
async function cursor(page) {
    return page.evaluate(() => {
        const active = document.activeElement;
        const row = active && active.closest ? active.closest('tr.zA') : null;
        if (!row) {
            return active ? active.tagName.toLowerCase() : null;
        }
        if (row.classList.contains('bundle-row')) {
            return row.querySelector('.bundle-and-count span').textContent.trim();
        }
        return row.querySelector('.y6 span span').textContent;
    });
}

/**
 * The row Gmail marks as its cursor (subject), or null.
 */
async function gmailCursor(page) {
    return page.evaluate(() => {
        const row = document.querySelector('tr.zA.btb:not(.bundle-row)');
        return row ? row.querySelector('.y6 span span').textContent : null;
    });
}

async function actions(page) {
    return page.evaluate(() => window.__gmail.actions);
}

test.describe('Gmail whose cursor follows focus', () => {
    let context;
    let cleanup;

    test.beforeAll(async () => {
        ({ context, cleanup } = await launchWithExtension());
        await serveInbox(context, inboxPage({ threads: THREADS }));
    });

    test.afterAll(async () => {
        await cleanup();
    });

    test('j and k walk the visible rows with bundle rows as stops', async () => {
        const page = await openInbox(context);

        const walk = [];
        const gmailMarks = [];
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('j');
            walk.push(await cursor(page));
            gmailMarks.push(await gmailCursor(page));
        }
        // Four stops; the fifth j stays put at the end of the list.
        expect(walk).toEqual(['Loose A', 'Work', 'Loose B', 'News', 'News']);
        // Gmail's own mark follows onto message rows and is cleared on bundle
        // rows: it never sits on a hidden thread along the way.
        expect(gmailMarks).toEqual(['Loose A', null, 'Loose B', null, null]);
        await expect(page.locator('.bundle-row.inbundly-cursor')).toHaveText(/News/);

        await page.keyboard.press('k');
        expect(await cursor(page)).toBe('Loose B');
        expect(await gmailCursor(page)).toBe('Loose B');
        await expect(page.locator('.inbundly-cursor')).toHaveCount(0);
        await page.keyboard.press('k');
        expect(await cursor(page)).toBe('Work');

        await page.close();
    });

    test('Enter opens the bundle; the cursor lands on its first thread and e archives it', async () => {
        const page = await openInbox(context);

        await page.keyboard.press('j');
        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Work');

        await page.keyboard.press('Enter');
        await expect(page.locator('.bundled-message.visible')).toHaveCount(2);
        expect(await cursor(page)).toBe('Work 1');
        expect(await gmailCursor(page)).toBe('Work 1');

        await page.keyboard.press('e');
        expect(await actions(page)).toEqual([{ type: 'archive', subjects: ['Work 1'] }]);

        await page.close();
    });

    test('j walks through the open bundle and out; k back to its row; Enter collapses', async () => {
        const page = await openInbox(context);

        await page.keyboard.press('j');
        await page.keyboard.press('j');
        await page.keyboard.press('Enter');
        expect(await cursor(page)).toBe('Work 1');

        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Work 2');
        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Loose B');

        await page.keyboard.press('k');
        await page.keyboard.press('k');
        await page.keyboard.press('k');
        expect(await cursor(page)).toBe('Work');
        await expect(page.locator('.bundle-row.visible')).toHaveText(/Work/);

        await page.keyboard.press('Enter');
        await expect(page.locator('.bundled-message.visible')).toHaveCount(0);
        expect(await cursor(page)).toBe('Work');

        await page.close();
    });

    test('clicking a bundle open moves the cursor onto its first thread (inboxy#50)', async () => {
        const page = await openInbox(context);

        await page.locator('.bundle-row', { hasText: 'Work' }).click();
        await expect(page.locator('.bundled-message.visible')).toHaveCount(2);
        expect(await cursor(page)).toBe('Work 1');
        expect(await gmailCursor(page)).toBe('Work 1');

        await page.keyboard.press('e');
        expect(await actions(page)).toEqual([{ type: 'archive', subjects: ['Work 1'] }]);

        await page.close();
    });

    test('Escape inside an open bundle collapses it and lands on the bundle row', async () => {
        const page = await openInbox(context);

        await page.locator('.bundle-row', { hasText: 'Work' }).click();
        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Work 2');

        await page.keyboard.press('Escape');
        await expect(page.locator('.bundled-message.visible')).toHaveCount(0);
        expect(await cursor(page)).toBe('Work');
        // A user close forgets the remembered bundle, like a click would.
        expect(await page.evaluate(() => sessionStorage.getItem('inbundly:openBundle:v1')))
            .toBeNull();

        await page.close();
    });

    test('on a bundle row, e archives the whole bundle and s is inert', async () => {
        const page = await openInbox(context);

        await page.keyboard.press('j');
        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Work');

        await page.keyboard.press('s');
        expect(await actions(page)).toEqual([]);

        await page.keyboard.press('e');
        await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
        await expect.poll(() => actions(page)).toEqual([
            { type: 'archive', subjects: ['Work 1', 'Work 2'] },
        ]);

        await page.close();
    });

    test('x on a bundle row selects all of it', async () => {
        const page = await openInbox(context);

        await page.keyboard.press('j');
        await page.keyboard.press('j');
        await page.keyboard.press('x');

        await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
        await expect(page.locator('.bundle-row', { hasText: 'Work' }).locator('.bundle-checkbox'))
            .toHaveAttribute('aria-checked', 'true');

        await page.close();
    });

    test('a Gmail cursor stranded on a hidden thread resumes from its bundle row', async () => {
        const page = await openInbox(context);

        await page.evaluate(() => {
            const hidden = [...document.querySelectorAll('tr.zA.bundled-message')]
                .find(r => r.textContent.includes('Work 2'));
            hidden.classList.add('btb');
        });

        await page.keyboard.press('j');
        // Gmail alone would step to the next DOM row (News 1, also hidden).
        expect(await cursor(page)).toBe('Loose B');

        await page.close();
    });

    test('typing in a text field is left alone', async () => {
        const page = await openInbox(context);

        await page.locator('#fixture-search').focus();
        await page.keyboard.press('j');

        expect(await cursor(page)).toBe('input');
        expect(await gmailCursor(page)).toBeNull();

        await page.close();
    });
});

test.describe('Gmail whose cursor ignores focus', () => {
    let context;
    let cleanup;

    test.beforeAll(async () => {
        ({ context, cleanup } = await launchWithExtension());
        await serveInbox(context, inboxPage({ threads: THREADS, cursorFollowsFocus: false }));
    });

    test.afterAll(async () => {
        await cleanup();
    });

    test('e still archives the row the user sees, through the toolbar', async () => {
        const page = await openInbox(context);

        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Loose A');
        expect(await gmailCursor(page)).toBeNull();

        await page.keyboard.press('e');
        await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveText(/Loose A/);
        await expect.poll(() => actions(page)).toEqual([
            { type: 'archive', subjects: ['Loose A'] },
        ]);

        await page.close();
    });

    test('inside an open bundle, x and Enter act on the visible thread', async () => {
        const page = await openInbox(context);

        await page.locator('.bundle-row', { hasText: 'Work' }).click();
        await page.keyboard.press('j');
        expect(await cursor(page)).toBe('Work 2');

        await page.keyboard.press('Enter');
        expect(await actions(page)).toEqual([{ type: 'open', subjects: ['Work 2'] }]);

        await page.keyboard.press('x');
        await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveText(/Work 2/);

        await page.close();
    });
});
