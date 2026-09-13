// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Archive-all and date-sweep switches: skip starred (pinned), mark read,
// unstar (TESTING.md section 15; issues #40 and #48).

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

// Every thread is from today, so one "Today" divider sweeps them all. The
// pinned thread carries the Work label: with the default keepStarredUnbundled
// it sits outside the bundle as a plain row (the date sweep reaches it); with
// that option off it joins the bundle (archive-all reaches it).
const THREADS = [
    { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'], unread: true },
    { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
    { email: 'c@corp-three.com', subject: 'Work pinned', labels: ['Work'], starred: true },
    { email: 'd@corp-four.com', subject: 'Outside message' },
];

const DEFAULT_SWITCHES = {
    skipStarredOnArchive: false,
    markReadOnArchive: false,
    unstarOnArchive: false,
    keepStarredUnbundled: true,
};

test.beforeAll(async () => {
    ({ context, cleanup } = await launchWithExtension());
    await serveInbox(context, inboxPage({ threads: THREADS }));
});

test.afterAll(async () => {
    await cleanup();
});

test.afterEach(async () => {
    await setSyncOptions(context, DEFAULT_SWITCHES);
});

function workBundle(page) {
    return page.locator('.bundle-row', { hasText: 'Work' });
}

// By exact subject: every row's text also holds its label chip and date, so
// a loose hasText('Work 1') would match "Work 10:00 AM" on other rows too.
function row(page, subject) {
    return page.locator('tr.zA:not(.bundle-row)', {
        has: page.locator('.y6 span span', { hasText: new RegExp(`^${subject}$`) }),
    });
}

const gmailClicks = page => page.evaluate(() => window.__gmail.clicks);
const gmailActions = page => page.evaluate(() => window.__gmail.actions);
const archiveSubjects = async page =>
    (await gmailActions(page)).filter(a => a.type === 'archive').map(a => a.subjects);

test('by default the date sweep archives everything, pinned thread included', async () => {
    const page = await openInbox(context);
    await expect(page.locator('.date-row')).toHaveCount(1);

    await page.locator('.date-row .archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
    expect(await archiveSubjects(page)).toEqual([
        ['Work 1', 'Work 2', 'Work pinned', 'Outside message'],
    ]);
    // Nothing else was touched: no Mark as read, star still on.
    expect((await gmailActions(page)).map(a => a.type)).toEqual(['archive']);
    await expect(row(page, 'Work pinned').locator('.T-KT-Jp')).toHaveCount(1);

    await page.close();
});

test('flipping an archive switch does not refresh Gmail or rebundle', async () => {
    const page = await openInbox(context);

    await setSyncOptions(context, { skipStarredOnArchive: true, markReadOnArchive: true });
    // Give a refresh time to happen if one were wrongly requested.
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => window.__gmail.refreshes)).toBe(0);
    await expect(workBundle(page)).toHaveCount(1);

    await page.close();
});

test('skipStarredOnArchive: the date sweep leaves the pinned thread in place', async () => {
    await setSyncOptions(context, { skipStarredOnArchive: true });
    const page = await openInbox(context);

    await page.locator('.date-row .archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
    expect(await archiveSubjects(page)).toEqual([['Work 1', 'Work 2', 'Outside message']]);
    await expect(row(page, 'Work pinned')).not.toHaveClass(/x7/);
    await expect(row(page, 'Work pinned').locator('.T-KT-Jp')).toHaveCount(1);

    await page.close();
});

test('skipStarredOnArchive: archive-all skips a pinned thread inside the bundle', async () => {
    // Let the pinned thread bundle, so the bundle holds three threads.
    await setSyncOptions(context, { skipStarredOnArchive: true, keepStarredUnbundled: false });
    const page = await openInbox(context);
    await expect(workBundle(page).locator('.bundle-count')).toHaveText('(3)');

    await workBundle(page).locator('.archive-bundle').dispatchEvent('click');

    await expect(page.locator('tr.zA.x7:not(.bundle-row)')).toHaveCount(2);
    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
    expect(await archiveSubjects(page)).toEqual([['Work 1', 'Work 2']]);

    await page.close();
});

test('skipStarredOnArchive: a pinned thread checked by hand is left out too', async () => {
    await setSyncOptions(context, { skipStarredOnArchive: true });
    const page = await openInbox(context);

    // The user checks the pinned row itself, then sweeps the section.
    await page.evaluate(() => {
        const pinned = [...document.querySelectorAll('tr.zA')]
            .find(r => r.textContent.includes('Work pinned'));
        pinned.querySelector('.oZ-jc').click();
    });
    await expect(row(page, 'Work pinned')).toHaveClass(/x7/);

    await page.locator('.date-row .archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
    expect(await archiveSubjects(page)).toEqual([['Work 1', 'Work 2', 'Outside message']]);
    await expect(row(page, 'Work pinned')).not.toHaveClass(/x7/);

    await page.close();
});

test('markReadOnArchive: archive-all marks the bundle read through Gmail first', async () => {
    await setSyncOptions(context, { markReadOnArchive: true });
    const page = await openInbox(context);
    await expect(row(page, 'Work 1')).toHaveClass(/zE/);

    await workBundle(page).locator('.archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['Mark as read', 'act:7']);
    const actions = await gmailActions(page);
    expect(actions.map(a => a.type)).toEqual(['markRead', 'archive']);
    expect(actions[0].subjects).toEqual(['Work 1', 'Work 2']);
    expect(actions[1].subjects).toEqual(['Work 1', 'Work 2']);
    await expect(row(page, 'Work 1')).toHaveClass(/yO/);
    await expect(row(page, 'Work 1')).not.toHaveClass(/zE/);

    await page.close();
});

test('markReadOnArchive: an all-read selection goes straight to archive', async () => {
    await setSyncOptions(context, { markReadOnArchive: true });
    const page = await openInbox(context);

    // Mark Work 1 read the way Gmail would, before the sweep.
    await page.evaluate(() => {
        const unread = [...document.querySelectorAll('tr.zA')]
            .find(r => r.textContent.includes('Work 1'));
        unread.classList.remove('zE');
        unread.classList.add('yO');
    });

    await page.locator('.date-row .archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);

    await page.close();
});

test('unstarOnArchive: the date sweep unstars the pinned thread, then archives it', async () => {
    await setSyncOptions(context, { unstarOnArchive: true });
    const page = await openInbox(context);
    await expect(row(page, 'Work pinned').locator('.T-KT-Jp')).toHaveCount(1);

    await page.locator('.date-row .archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
    const actions = await gmailActions(page);
    expect(actions.map(a => a.type)).toEqual(['unstar', 'archive']);
    expect(actions[0].subjects).toEqual(['Work pinned']);
    expect(actions[1].subjects).toEqual(['Work 1', 'Work 2', 'Work pinned', 'Outside message']);
    await expect(row(page, 'Work pinned').locator('.T-KT-Jp')).toHaveCount(0);
    await expect(row(page, 'Work pinned').locator('.aXw')).toHaveCount(1);

    await page.close();
});

test('skip + unstar together: the skipped pinned thread keeps its star', async () => {
    await setSyncOptions(context, { skipStarredOnArchive: true, unstarOnArchive: true });
    const page = await openInbox(context);

    await page.locator('.date-row .archive-bundle').dispatchEvent('click');

    await expect.poll(() => gmailClicks(page)).toEqual(['act:7']);
    expect((await gmailActions(page)).map(a => a.type)).toEqual(['archive']);
    expect(await archiveSubjects(page)).toEqual([['Work 1', 'Work 2', 'Outside message']]);
    await expect(row(page, 'Work pinned').locator('.T-KT-Jp')).toHaveCount(1);

    await page.close();
});

test('the e shortcut on a bundle row runs archive-all under the same switches', async () => {
    await setSyncOptions(context, { markReadOnArchive: true });
    const page = await openInbox(context);

    // The Work bundle is the first row in display order; j lands on it.
    await page.keyboard.press('j');
    await expect(workBundle(page)).toHaveClass(/inbundly-cursor/);
    await page.keyboard.press('e');

    await expect.poll(() => gmailClicks(page)).toEqual(['Mark as read', 'act:7']);

    await page.close();
});
