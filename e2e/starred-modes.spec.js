// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Starred threads in every bundling mode (TESTING.md 6.7, 6.8): a bundle
// whose members are all starred does not exist with "Show starred on their
// own rows" on, and archive-all with "Archive buttons skip starred" leaves
// them alone. Each mode runs with the star as Gmail renders it on load (the
// yellow star, and a superstar drawn without T-KT-Jp) and as a live click,
// which in the fixture, as in Gmail, changes the star's names but not the
// class the row was rendered with.

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
});

test.afterAll(async () => {
    await cleanup();
});

const DEFAULTS = {
    keepStarredUnbundled: true,
    skipStarredOnArchive: false,
    combineLabels: true,
    priorityBundles: [],
    customBundles: null,
};

test.afterEach(async () => {
    await setSyncOptions(context, DEFAULTS);
});

// A loose thread from a freemail sender of its own: never bundles, so the
// list always has a row outside the bundle under test.
const LOOSE = { email: 'solo@gmail.com', subject: 'Loose thread' };

// Each mode: the pair of threads that forms one bundle, and the options that
// make it one. `custom` pairs are put in a custom bundle by thread id.
const MODES = [
    {
        name: 'single label',
        options: { combineLabels: false },
        pair: [
            { email: 'a@one.com', subject: 'Pair 1', labels: ['Trips'] },
            { email: 'b@two.com', subject: 'Pair 2', labels: ['Trips'] },
        ],
    },
    {
        name: 'grouped labels',
        options: { combineLabels: true },
        pair: [
            { email: 'a@one.com', subject: 'Pair 1', labels: ['Trips', 'Family'] },
            { email: 'b@two.com', subject: 'Pair 2', labels: ['Trips', 'Family'] },
        ],
    },
    {
        name: 'priority bundle',
        options: { priorityBundles: ['Trips + Family'] },
        pair: [
            { email: 'a@one.com', subject: 'Pair 1', labels: ['Trips', 'Family', 'Extra'] },
            { email: 'b@two.com', subject: 'Pair 2', labels: ['Family', 'Trips'] },
        ],
    },
    {
        name: 'custom bundle',
        custom: 'Side project',
        pair: [
            { email: 'a@one.com', subject: 'Pair 1' },
            { email: 'b@two.com', subject: 'Pair 2' },
        ],
    },
    {
        name: 'sender bundle',
        pair: [
            { email: 'news@acme.com', subject: 'Pair 1' },
            { email: 'billing@acme.com', subject: 'Pair 2' },
        ],
    },
];

// How the pair is starred: not at all (the control), on load with the
// yellow star or a superstar, or by live clicks after the first pass.
const STARS = [
    { name: 'yellow star on load', starred: true },
    { name: 'superstar on load', starred: 'Red star' },
    { name: 'starred live', starred: false, live: true },
];

async function serve(mode, starred, extraOptions = {}) {
    const threads = [
        ...mode.pair.map(t => ({ ...t, starred })),
        LOOSE,
    ];
    const html = inboxPage({ threads });
    const options = { ...DEFAULTS, ...(mode.options || {}), ...extraOptions };
    if (mode.custom) {
        const ids = [...html.matchAll(/data-legacy-thread-id="([0-9a-f]+)"/g)]
            .map(m => m[1])
            .slice(0, mode.pair.length);
        options.customBundles = { v: 1, bundles: { [mode.custom]: ids } };
    }
    await setSyncOptions(context, options);
    await context.unroute('https://mail.google.com/**');
    await serveInbox(context, html);
}

function row(page, subject) {
    return page.locator('tr.zA:not(.bundle-row)', {
        has: page.locator('.y6 span span', { hasText: new RegExp(`^${subject}$`) }),
    });
}

async function clickStar(page, subject) {
    await page.evaluate(s => {
        const target = [...document.querySelectorAll('tr.zA:not(.bundle-row)')]
            .find(r => r.querySelector('.y6 span span').textContent === s);
        const img = target.querySelector('.T-KT img');
        img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        img.click();
    }, subject);
}

const gmailClicks = page => page.evaluate(() => window.__gmail.clicks);
const gmailActions = page => page.evaluate(() => window.__gmail.actions);

for (const mode of MODES) {
    test.describe(mode.name, () => {
        test('6.7 control: the unstarred pair forms one bundle', async () => {
            await serve(mode, false);
            const page = await openInbox(context);
            await expect(page.locator('.bundle-row')).toHaveCount(1);
            await expect(page.locator('.bundle-row .bundle-count')).toHaveText('(2)');
            await page.close();
        });

        for (const stars of STARS) {
            test(`6.7 every member starred (${stars.name}): no bundle, both on their own rows`, async () => {
                await serve(mode, stars.starred);
                const page = await openInbox(context, { expectBundles: !!stars.live });
                if (stars.live) {
                    await clickStar(page, 'Pair 1');
                    await clickStar(page, 'Pair 2');
                }
                await expect(page.locator('.bundle-row')).toHaveCount(0);
                for (const subject of ['Pair 1', 'Pair 2']) {
                    await expect(row(page, subject)).not.toHaveClass(/bundled-message/);
                    await expect(row(page, subject)).toBeVisible();
                }
                await page.close();
            });

            test(`6.8 skip starred on archive, every member starred (${stars.name}): archive-all leaves them`, async () => {
                // Starred threads stay in the bundle (option off), so the
                // archive-all icon is what decides.
                await serve(mode, stars.starred, {
                    keepStarredUnbundled: false,
                    skipStarredOnArchive: true,
                });
                const page = await openInbox(context);
                if (stars.live) {
                    await clickStar(page, 'Pair 1');
                    await clickStar(page, 'Pair 2');
                }
                await expect(page.locator('.bundle-row .bundle-count')).toHaveText('(2)');

                await page.locator('.bundle-row .archive-bundle').dispatchEvent('click');
                await page.waitForTimeout(500);

                expect(await gmailClicks(page)).toEqual([]);
                expect((await gmailActions(page)).filter(a => a.type === 'archive'))
                    .toEqual([]);
                await page.close();
            });
        }

        test('6.8 skip starred on archive, one member starred live: only the other is archived', async () => {
            await serve(mode, false, {
                keepStarredUnbundled: false,
                skipStarredOnArchive: true,
            });
            const page = await openInbox(context);
            await clickStar(page, 'Pair 1');

            await page.locator('.bundle-row .archive-bundle').dispatchEvent('click');

            await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
            const archived = (await gmailActions(page)).filter(a => a.type === 'archive');
            expect(archived.map(a => a.subjects)).toEqual([['Pair 2']]);
            await page.close();
        });
    });
}
