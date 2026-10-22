#!/usr/bin/env node
// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2026  Ben Orozco

// Render the store / site screenshots and the Options-page clips from the
// e2e fixture inbox, with the real built extension (dist/) painting every
// bundle. Follows "Render spec for Lucca" in the v4.5.0 visuals plan.
//
//   npm run build && npm run render:assets            # everything
//   node marketing/render/render.js --only s1,c2      # a subset
//   node marketing/render/render.js --out /some/dir   # output directory
//
// Output defaults to /workspace/inbundly-store-assets (outside the repo; the
// shipped extension never sees any of this). See marketing/render/README.md.

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const lib = require('./lib');
const { ClipRecorder } = require('./clip');
const { at, variant, S1_INBOX } = require('./data');
const { CURSOR_SNIPPET } = require('./standin');

const args = process.argv.slice(2);
const argValue = flag => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
};
const OUT = path.resolve(argValue('--out') || process.env.RENDER_OUT || '/workspace/inbundly-store-assets');
const ONLY = (argValue('--only') || '').split(',').filter(Boolean);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'inbundly-frames-'));

const STILL = { width: 1280, height: 800 };
const CLIP = { width: 960, height: 600 };

/** DPR-2 capture -> Lanczos downscale -> sRGB PNG, no profile, no alpha. */
async function saveStill(buf, file, { width, height, alpha = false } = STILL) {
    let img = sharp(buf).resize(width, height, { kernel: 'lanczos3' });
    img = alpha ? img.ensureAlpha() : img.removeAlpha();
    await img.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(OUT, file));
    console.log('  wrote', file);
}

async function hideCursor(page) {
    await lib.setCursorVisible(page, false);
}

async function centerOf(locator) {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('element not visible');
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Move the real mouse (hover is real) and show the drawn pointer there. */
async function pointAt(page, locator) {
    const { x, y } = await centerOf(locator);
    await page.mouse.move(x - 40, y + 30);
    await page.mouse.move(x, y, { steps: 4 });
    await lib.settle(page, 300);
}

// ---------------------------------------------------------------- stills

const STILLS = {
    // S1: the whole idea, all bundles closed, no pointer.
    async s1() {
        const env = await lib.launch({ viewport: STILL });
        await env.setOptions(lib.RENDER_OPTIONS);
        const page = await lib.openScene(env, { entries: S1_INBOX });
        await hideCursor(page);
        await saveStill(await page.screenshot(), 's1-inbox-bundles-light.png');
        await env.close();
    },

    // S2: latest-sender glance on closed bundles; Work open below.
    async s2() {
        const env = await lib.launch({ viewport: STILL, colorScheme: 'dark' });
        await env.setOptions(lib.RENDER_OPTIONS);
        const page = await lib.openScene(env, { entries: S1_INBOX, theme: 'dark' });
        await lib.openBundle(page, 'Work');
        await lib.setCursorVisible(page, true);
        await pointAt(page, lib.bundleRow(page, 'Travel').locator('.bundle-latest-sender'));
        await saveStill(await page.screenshot(), 's2-sender-glance-dark.png');
        await env.close();
    },

    // S3: a starred thread steps out of its bundle onto its own row.
    async s3() {
        const env = await lib.launch({ viewport: STILL });
        await env.setOptions(lib.RENDER_OPTIONS);
        const entries = variant(S1_INBOX, { mayaBudget: { starred: true } });
        const page = await lib.openScene(env, { entries });
        await lib.openBundle(page, 'Work');
        await lib.setCursorVisible(page, true);
        await pointAt(page, lib.threadRowLocator(page, 'Q4 budget, final numbers').locator('td.apU .T-KT'));
        await saveStill(await page.screenshot(), 's3-starred-popout-light.png');
        await env.close();
    },

    // S4: archive-all on a hovered Newsletters bundle; a starred thread in
    // Yesterday; "Archive buttons skip starred" on.
    async s4() {
        const env = await lib.launch({ viewport: STILL, colorScheme: 'dark' });
        await env.setOptions({ ...lib.RENDER_OPTIONS, skipStarredOnArchive: true });
        const entries = [
            ...variant(S1_INBOX, { slowHabits: { day: 1, time: '5:30 PM' } }),
            at('dentist', 1, '9:05 AM', { starred: true }),
        ];
        const page = await lib.openScene(env, { entries, theme: 'dark' });
        await lib.setCursorVisible(page, true);
        const row = lib.bundleRow(page, 'Newsletters');
        await row.hover({ position: { x: 300, y: 20 } });
        await pointAt(page, row.locator('.archive-bundle'));
        await saveStill(await page.screenshot(), 's4-archive-skips-starred-dark.png');
        await env.close();
    },

    // S5: the v4.5.0 Options page at the Starred threads section.
    async s5() {
        const env = await lib.launch({ viewport: STILL });
        const page = await env.context.newPage();
        await page.goto(`chrome-extension://${env.extensionId}/options/options.html#options`);
        await page.evaluate(() => document.fonts.ready);
        await lib.settle(page, 600);
        await page.evaluate(() => {
            const card = document.getElementById('pinned-messages');
            window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 40);
        });
        await lib.settle(page, 400);
        await saveStill(await page.screenshot(), 's5-options-light.png');
        await env.close();
    },

    // Alternate: keyboard cursor ring on the Newsletters bundle row.
    async 'alt-k'() {
        const env = await lib.launch({ viewport: STILL, colorScheme: 'dark' });
        await env.setOptions(lib.RENDER_OPTIONS);
        const page = await lib.openScene(env, { entries: S1_INBOX, theme: 'dark' });
        await hideCursor(page);
        await page.mouse.move(2, 2);
        for (let i = 0; i < 20; i++) {
            await page.keyboard.press('j');
            await page.waitForTimeout(120);
            const onTarget = await page.evaluate(() => {
                const row = document.querySelector('tr.bundle-row.inbundly-cursor');
                return !!row && /^Newsletters/.test(row.querySelector('.bundle-and-count').textContent.trim());
            });
            if (onTarget) {
                break;
            }
        }
        await lib.settle(page, 300);
        await saveStill(await page.screenshot(), 's-alt-k-keyboard-dark.png');
        await env.close();
    },

    // Alternate: search results get bundles too.
    async 'alt-v'() {
        const env = await lib.launch({ viewport: STILL });
        await env.setOptions({ ...lib.RENDER_OPTIONS, bundleOtherViews: true });
        const entries = [
            at('puffCheckin', 0, '9:12 AM', { unread: true }),
            at('casaTips', 0, '8:20 AM'),
            at('puffTripReceipt', 1, '6:05 PM'),
            at('diegoTrip', 1, '11:40 AM'),
            at('puffTrip', 2, '5:45 PM'),
            at('fenniTrip', 2, '3:10 PM'),
            at('casaCheckin', 3, '12:10 PM'),
        ];
        const page = await lib.openScene(env, { entries, search: 'trip', hash: 'search/trip' });
        await hideCursor(page);
        await saveStill(await page.screenshot(), 's-alt-v-search-light.png');
        await env.close();
    },

    // Hero A raw frames: the same mail with bundling off, then bundled with
    // Work open. Raw captures only; the composite is designed separately.
    async 'hero-a'() {
        const size = { width: 1100, height: 900 };
        for (const [file, bundling] of [
            ['hero-a-raw-unbundled-light.png', false],
            ['hero-a-raw-bundled-light.png', true],
        ]) {
            const env = await lib.launch({ viewport: size });
            await env.setOptions({ ...lib.RENDER_OPTIONS, bundlingEnabled: bundling });
            const page = await lib.openScene(env, {
                entries: S1_INBOX,
                expect: bundling ? 'bundles' : 'plain',
            });
            if (bundling) {
                await lib.openBundle(page, 'Work');
            }
            await hideCursor(page);
            await saveStill(await page.screenshot(), file, size);
            await env.close();
        }
    },

    // Optional raw bundle rows for the tile / marquee illustration: label
    // colors "fill", transparent page, enlarged.
    async 'tile-rows'() {
        const env = await lib.launch({ viewport: { width: 1200, height: 900 } });
        await env.setOptions({ ...lib.RENDER_OPTIONS, bundleColorStyle: 'background' });
        const page = await lib.openScene(env, { entries: S1_INBOX, nav: false, transparent: true });
        await hideCursor(page);
        await page.addStyleTag({ content: `
            #gb, .G-atb, .date-row { display: none !important; }
            .bkK { padding: 0 !important; }
            .bkK > .nH { border-radius: 0 !important; }
            .bkK .UI { zoom: 1.5; }
            tr.zA { border-bottom: 0 !important; }
        ` });
        await lib.settle(page, 300);
        for (const title of ['Travel', 'Receipts', 'Family']) {
            const row = lib.bundleRow(page, title);
            // Kept at full DPR-2 resolution for the illustrator.
            const buf = await row.screenshot({ omitBackground: true });
            const file = `tile-raw-row-${title.toLowerCase()}.png`;
            await sharp(buf).ensureAlpha().png({ compressionLevel: 9 }).toFile(path.join(OUT, file));
            console.log('  wrote', file);
        }
        await env.close();
    },
};

// ----------------------------------------------------------------- clips

const REST = { x: 860, y: 88 };   // toolbar's empty right side: hovers nothing

const CLIPS = {
    // C1: star thread 3 of the open Work bundle, it steps out; unstar, it
    // goes back. Ends on frame 0.
    async c1() {
        const env = await lib.launch({ viewport: CLIP });
        await env.setOptions(lib.RENDER_OPTIONS);
        const entries = [
            at('passport', 0, '9:41 AM', { starred: true }),
            at('mayaBudget', 0, '9:20 AM'),
            at('anaReview', 0, '8:55 AM'),
            at('samKickoff', 0, '8:30 AM'),
            at('priyaRsvp', 0, '8:02 AM'),
            at('puffCheckin', 0, '7:40 AM', { unread: true }),
            at('puffTrip', 2, '5:45 PM'),
            at('casaCheckin', 3, '12:10 PM'),
            at('momLunch', 1, '6:40 PM'),
            at('diegoPhotos', 1, '10:10 AM'),
            at('momRecipe', 4, '7:15 PM'),
            at('diegoPlans', 7, '9:20 PM'),
        ];
        const page = await lib.openScene(env, { entries, nav: false });
        await lib.openBundle(page, 'Work');
        await lib.setCursorVisible(page, true);
        const rec = new ClipRecorder({ name: 'c1-starred-popout', panels: [{ page, css: { x: 0, y: 0 } }], ...CLIP, frameDir: path.join(WORK, 'c1') });
        await rec.place(page, REST.x, REST.y);
        await lib.settle(page, 200);
        await rec.frame();
        await rec.holdUntil(0.4);
        const star = () => lib.threadRowLocator(page, 'Kickoff notes: Harbor project').locator('td.apU .T-KT');
        let p = await centerOf(star());
        await rec.moveTo(page, p.x, p.y, 1.3);
        await rec.holdUntil(1.5);
        await rec.click(page);
        await rec.holdUntil(2.5);
        p = await centerOf(star());
        await rec.moveTo(page, p.x, p.y, 3.6);
        await rec.holdUntil(4.0);
        await rec.click(page);
        await rec.holdUntil(4.4);
        await rec.moveTo(page, REST.x, REST.y, 5.5);
        await rec.holdUntil(6.0);
        await rec.encode(OUT);
        console.log('  wrote c1-starred-popout.{webm,mp4} + poster');
        await env.close();
        return rec;
    },

    // C2: the Yesterday heading's archive button skips the starred thread.
    async c2() {
        const env = await lib.launch({ viewport: CLIP });
        await env.setOptions({ ...lib.RENDER_OPTIONS, skipStarredOnArchive: true });
        const entries = [
            at('quillSlip', 0, '9:15 AM', { unread: true }),
            at('puffCheckin', 0, '8:40 AM'),
            at('puffTrip', 2, '5:45 PM'),
            at('casaCheckin', 3, '12:10 PM'),
            at('momLunch', 1, '6:40 PM'),
            at('diegoPhotos', 1, '10:10 AM'),
            at('parcelDelivered', 1, '4:12 PM'),
            at('parcelOut', 1, '8:03 AM'),
            at('parcelLabel', 3, '11:02 AM'),
            at('mayaBudget', 1, '3:30 PM'),
            at('anaReview', 1, '1:15 PM'),
            at('samKickoff', 2, '4:20 PM'),
            at('priyaRsvp', 5, '10:05 AM'),
            at('lease', 1, '2:05 PM'),
            at('dentist', 1, '9:05 AM', { starred: true }),
        ];
        const page = await lib.openScene(env, { entries, nav: false, archiveRemovesRows: true });
        await lib.setCursorVisible(page, true);
        const rec = new ClipRecorder({ name: 'c2-heading-archive-skips-starred', panels: [{ page, css: { x: 0, y: 0 } }], ...CLIP, frameDir: path.join(WORK, 'c2') });
        await rec.place(page, REST.x, REST.y);
        await lib.settle(page, 200);
        await rec.frame();
        await rec.holdUntil(0.6);
        const button = page.locator('.date-row', { hasText: 'Yesterday' }).locator('.archive-bundle');
        const p = await centerOf(button);
        await rec.moveTo(page, p.x, p.y, 1.7);
        await rec.holdUntil(2.0);
        await rec.click(page, 1200);
        await rec.holdUntil(5.0);
        await rec.moveTo(page, REST.x, REST.y, 6.0);
        await rec.holdUntil(6.6);
        await rec.crossfadeToStart(0.4);
        await rec.encode(OUT);
        console.log('  wrote c2-heading-archive-skips-starred.{webm,mp4} + poster');
        await env.close();
        return rec;
    },

    // C3 / C4: Options switch (left 30%) next to the inbox (right 70%), one
    // browser, two tabs; the switch saves to chrome.storage.sync and the
    // inbox rebundles from it, as in real use.
    c3: () => splitClip({
        name: 'c3-label-combinations',
        switchId: 'combine-labels-checkbox',
        options: { ...lib.RENDER_OPTIONS, combineLabels: false, priorityBundles: [] },
        entries: [
            at('mayaBudget', 0, '9:20 AM', { unread: true }),
            at('anaRedlines', 0, '9:02 AM'),
            at('anaReview', 0, '8:40 AM'),
            at('samKickoff', 0, '8:10 AM'),
            at('priyaRsvp', 0, '7:45 AM'),
            at('priyaRetro', 1, '5:10 PM'),
            at('puffCheckin', 0, '7:20 AM'),
            at('puffTrip', 2, '5:45 PM'),
            at('casaCheckin', 3, '12:10 PM'),
            at('slowHabits', 1, '7:30 AM'),
            at('briskTuesday', 1, '7:00 AM'),
            at('thornSale', 3, '8:00 AM'),
        ],
    }),
    c4: () => splitClip({
        name: 'c4-sender-bundles',
        switchId: 'sender-bundling-checkbox',
        options: { ...lib.RENDER_OPTIONS, senderBundling: false },
        entries: [
            at('fenniReceipt', 0, '9:30 AM', { labels: [], unread: true }),
            at('puffCheckin', 0, '9:05 AM', { labels: [] }),
            at('fenniBasket', 0, '8:20 AM'),
            at('puffTrip', 0, '7:45 AM', { labels: [] }),
            at('fenniBack', 0, '7:10 AM'),
            at('mayaBudget', 1, '3:30 PM'),
            at('anaReview', 1, '1:15 PM'),
            at('samKickoff', 2, '4:20 PM'),
            at('slowHabits', 1, '7:30 AM'),
            at('briskTuesday', 1, '7:00 AM'),
            at('thornSale', 3, '8:00 AM'),
        ],
    }),
};

const SPLIT_LEFT = Math.round(CLIP.width * 0.3);   // 288

async function splitClip({ name, switchId, options, entries }) {
    const env = await lib.launch({ viewport: CLIP });
    await env.setOptions(options);
    const inbox = await lib.openScene(env, { entries, nav: false });
    await inbox.setViewportSize({ width: CLIP.width - SPLIT_LEFT, height: CLIP.height });
    await hideCursor(inbox);
    await inbox.mouse.move(1, 1);
    const opts = await env.context.newPage();
    // Taller than the panel, then cropped: the page's fixed "Changes save
    // automatically" pill sits below the crop instead of over the switches
    // (at this narrow width it would cover them).
    await opts.setViewportSize({ width: SPLIT_LEFT, height: CLIP.height + 400 });
    await opts.goto(`chrome-extension://${env.extensionId}/options/options.html#options`);
    await opts.evaluate(() => document.fonts.ready);
    await opts.evaluate(CURSOR_SNIPPET);
    await lib.settle(opts, 500);
    const rowSel = `.option-row:has(#${switchId})`;
    await opts.evaluate(sel => {
        const row = document.querySelector(sel);
        const top = row.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - 170);
    }, rowSel);
    await lib.settle(opts, 300);
    await lib.settle(inbox, 300);

    const rec = new ClipRecorder({
        name,
        panels: [
            { page: opts, css: { x: 0, y: 0 }, clip: { x: 0, y: 0, width: SPLIT_LEFT, height: CLIP.height } },
            { page: inbox, css: { x: SPLIT_LEFT, y: 0 } },
        ],
        ...CLIP,
        frameDir: path.join(WORK, name),
    });
    const sw = await centerOf(opts.locator(`${rowSel} .slider`));
    const rest = { x: sw.x + 4, y: sw.y + 120 };
    await rec.place(opts, rest.x, rest.y);
    await lib.settle(opts, 200);
    await rec.frame();
    await rec.holdUntil(0.4);
    await rec.moveTo(opts, sw.x, sw.y, 1.3);
    await rec.holdUntil(1.5);
    await rec.click(opts, 1500);
    await lib.settle(inbox, 300);
    await rec.frame();
    await rec.holdUntil(4.5);
    await rec.click(opts, 1500);
    await lib.settle(inbox, 300);
    await rec.frame();
    await rec.moveTo(opts, rest.x, rest.y, 5.6);
    // The "Saved" flash fades before the loop point.
    await opts.waitForTimeout(2500);
    await rec.frame();
    await rec.holdUntil(6.0);
    await rec.encode(OUT);
    console.log(`  wrote ${name}.{webm,mp4} + poster`);
    await env.close();
    return rec;
}

// ------------------------------------------------------------------ main

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const jobs = { ...STILLS, ...CLIPS };
    const names = ONLY.length ? ONLY : Object.keys(jobs);
    for (const name of names) {
        if (!jobs[name]) {
            throw new Error(`unknown job ${name}; known: ${Object.keys(jobs).join(', ')}`);
        }
        console.log(name);
        await jobs[name]();
    }
    fs.rmSync(WORK, { recursive: true, force: true });
    console.log(`done: ${OUT}`);
})().catch(err => {
    console.error(err);
    process.exit(1);
});
