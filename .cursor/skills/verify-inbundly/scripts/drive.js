#!/usr/bin/env node
// Inbundly verification driver (see ../SKILL.md and ../features/).
//
// Walks ONE mapped feature the way a user would, on top of the repo's own
// Playwright e2e harness (e2e/helpers/gmail.js + e2e/fixture/inbox.js): the
// built extension is loaded into Chromium and a Gmail-shaped fixture page is
// served at mail.google.com. Every step records a screenshot, an ARIA
// snapshot of the message list, and the observed values it checked, into the
// evidence directory. Exit code 0 means every check passed.
//
//   node .cursor/skills/verify-inbundly/scripts/drive.js doctor
//   node .cursor/skills/verify-inbundly/scripts/drive.js <feature> --evidence <dir>
//
// Features: core-bundling, bundle-actions, sender-bundles,
//           remember-open-bundle, options-autosave

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const { inboxPage } = require(path.join(ROOT, 'e2e', 'fixture', 'inbox'));
const {
    launchWithExtension,
    serveInbox,
    openInbox,
    setSyncOptions,
} = require(path.join(ROOT, 'e2e', 'helpers', 'gmail'));

// Pinned by dist/manifest.json `key`; test/ExtensionId.test.js guards it.
const EXPECTED_EXTENSION_ID = 'cpggdbckpaoikhddngoeepdedfkleiab';
const OPEN_BUNDLE_STORE_KEY = 'inbundly:openBundle:v1';

// ---------------------------------------------------------------------------
// Evidence recorder

class Recorder {
    constructor(dir, feature) {
        this.dir = dir;
        this.feature = feature;
        this.steps = [];
        this.console = [];
        this.startedAt = new Date().toISOString();
        fs.mkdirSync(dir, { recursive: true });
    }

    watch(page, tag) {
        page.on('console', msg => {
            this.console.push(`[${tag}] ${msg.type()}: ${msg.text()}`);
        });
        page.on('pageerror', err => {
            this.console.push(`[${tag}] pageerror: ${err.message}`);
        });
    }

    /**
     * Run one user action, then evaluate its checks and capture the state.
     * `shots` lists { page, tag, ariaRoot } entries to screenshot and
     * ARIA-snapshot after the step; pass a function when the page is only
     * known once the action has run.
     */
    async step(name, { action, checks = [], shots = [] }) {
        const index = String(this.steps.length + 1).padStart(2, '0');
        const record = { index, name, checks: [], artifacts: [] };
        let actionError = null;
        try {
            await action();
        }
        catch (err) {
            actionError = err;
            record.actionError = String(err && err.stack || err);
        }
        for (const check of checks) {
            record.checks.push(await evaluateCheck(check));
        }
        const shotList = typeof shots === 'function' ? shots() : shots;
        for (const shot of shotList) {
            const base = `${index}-${name}${shot.tag ? '-' + shot.tag : ''}`;
            try {
                await shot.page.screenshot({
                    path: path.join(this.dir, `${base}.png`),
                    fullPage: true,
                });
                record.artifacts.push(`${base}.png`);
                const aria = await shot.page.locator(shot.ariaRoot || 'body').ariaSnapshot();
                fs.writeFileSync(path.join(this.dir, `${base}.aria.txt`), aria + '\n');
                record.artifacts.push(`${base}.aria.txt`);
            }
            catch (err) {
                record.artifacts.push(`capture failed: ${err && err.message || err}`);
                record.captureFailed = true;
            }
        }
        // Missing evidence fails the step: a proof without artifacts is not one.
        record.pass = !actionError && !record.captureFailed && record.checks.every(c => c.pass);
        this.steps.push(record);
        const mark = record.pass ? 'PASS' : 'FAIL';
        console.log(`  [${mark}] ${index} ${name}`);
        for (const c of record.checks) {
            console.log(`         ${c.pass ? 'ok  ' : 'FAIL'} ${c.label}: ${JSON.stringify(c.observed)}`);
        }
        if (actionError) {
            console.log(`         action threw: ${actionError.message || actionError}`);
        }
        for (const a of record.artifacts.filter(a => a.startsWith('capture failed'))) {
            console.log(`         ${a}`);
        }
        return record.pass;
    }

    finish(meta) {
        const pass = this.steps.length > 0 && this.steps.every(s => s.pass);
        const result = {
            feature: this.feature,
            pass,
            startedAt: this.startedAt,
            finishedAt: new Date().toISOString(),
            ...meta,
        };
        fs.writeFileSync(path.join(this.dir, 'steps.json'), JSON.stringify(this.steps, null, 2) + '\n');
        fs.writeFileSync(path.join(this.dir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
        fs.writeFileSync(path.join(this.dir, 'console.log'), this.console.join('\n') + '\n');
        const lines = [
            `# ${this.feature}: ${pass ? 'PASS' : 'FAIL'}`,
            '',
            `Extension ${meta.extensionId} v${meta.extensionVersion}, ${this.startedAt}`,
            '',
        ];
        for (const s of this.steps) {
            lines.push(`- ${s.pass ? 'PASS' : 'FAIL'} ${s.index} ${s.name}`);
            for (const c of s.checks) {
                lines.push(`  - ${c.pass ? 'ok' : 'FAIL'} ${c.label}: ${JSON.stringify(c.observed)}`);
            }
            for (const a of s.artifacts) {
                lines.push(`  - artifact: ${a}`);
            }
        }
        fs.writeFileSync(path.join(this.dir, 'walk.md'), lines.join('\n') + '\n');
        return pass;
    }
}

// Check builders: observe() reads the app, expect() judges the value. A check
// with `timeoutMs` is polled until it passes or the time is up (for state the
// extension reaches asynchronously, like a toolbar click after a selection).
const eq = (label, observe, expected) =>
    ({ label, observe, expect: v => JSON.stringify(v) === JSON.stringify(expected) });
const truthy = (label, observe) => ({ label, observe, expect: v => !!v });
const falsy = (label, observe) => ({ label, observe, expect: v => !v });
const gte = (label, observe, min) => ({ label, observe, expect: v => v >= min });
const includes = (label, observe, needle) =>
    ({ label, observe, expect: v => Array.isArray(v) ? v.includes(needle) : String(v).includes(needle) });
const eventually = (check, timeoutMs = 5000) => ({ ...check, timeoutMs });

async function evaluateCheck(check) {
    const deadline = Date.now() + (check.timeoutMs || 0);
    for (;;) {
        let observed;
        let pass = false;
        try {
            observed = await check.observe();
            pass = check.expect(observed);
        }
        catch (err) {
            observed = `error: ${err && err.message || err}`;
        }
        if (pass || Date.now() >= deadline) {
            return { label: check.label, observed, pass };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// ---------------------------------------------------------------------------
// Harness glue

async function extensionInfo(context) {
    const worker = context.serviceWorkers()[0]
        || await context.waitForEvent('serviceworker', { timeout: 10000 });
    return {
        worker,
        extensionId: await worker.evaluate(() => chrome.runtime.id),
        extensionVersion: await worker.evaluate(() => chrome.runtime.getManifest().version),
    };
}

// Observers take a `() => page` getter because checks are declared before the
// step's action has opened the page.
const count = (P, selector) => () => P().locator(selector).count();
const htmlClass = P => () => P().locator('html').getAttribute('class');
const hasClass = (L, name) => async () => {
    const cls = await L().getAttribute('class');
    return (cls || '').split(/\s+/).includes(name);
};
const text = L => async () => (await L().innerText()).replace(/\s+/g, ' ').trim();
const gmailClicks = P => () => P().evaluate(() => window.__gmail.clicks);
const openBundleStore = P => () => P().evaluate(k => sessionStorage.getItem(k), OPEN_BUNDLE_STORE_KEY);
const rowSelectedCount = P => count(P, 'tr.zA.x7:not(.bundle-row)');
const visibleBundledMessages = P => count(P, '.bundled-message.visible');

// The fixture toggles a native row checkbox the synthetic way, exactly as
// e2e/bundle-actions.spec.js does: a real click would run through Gmail's
// quick-select handler, which is not the behavior under test.
async function toggleRowCheckbox(page, subjectText) {
    await page.evaluate(text => {
        const row = [...document.querySelectorAll('tr.zA')]
            .find(r => r.textContent.includes(text) && !r.classList.contains('bundle-row'));
        row.querySelector('.oZ-jc').click();
    }, subjectText);
}

// Bundle action icons are hover-revealed (display:none until the row is
// hovered), so the user path is hover the row, then click the icon.
async function clickBundleAction(bundleRow, actionClass) {
    await bundleRow.hover();
    await bundleRow.locator(actionClass).click();
}

const bundleCheckbox = bundleRow =>
    bundleRow.getByRole('checkbox', { name: 'Select all messages in this bundle' });

// ---------------------------------------------------------------------------
// Feature walks. Each receives { context, rec, info } and returns nothing;
// checks are recorded through rec.step.

const FEATURES = {

    async 'core-bundling'({ context, rec }) {
        await serveInbox(context, inboxPage({
            threads: [
                { email: 'a@corp-one.com', subject: 'Work update 1', labels: ['Work'], daysAgo: 0 },
                { email: 'b@corp-two.com', subject: 'Work update 2', labels: ['Work'], daysAgo: 0, unread: true },
                { email: 'c@corp-three.com', subject: 'Urgent work A', labels: ['Work', 'Urgent'], daysAgo: 0 },
                { email: 'd@corp-four.com', subject: 'Urgent work B', labels: ['Work', 'Urgent'], daysAgo: 0 },
                { email: 'e@corp-five.com', subject: 'Lone receipt', labels: ['Receipts'], daysAgo: 0 },
                { email: 'f@corp-six.com', subject: 'Just a message', daysAgo: 40 },
            ],
        }));
        let page;
        const P = () => page;
        const shots = () => [{ page, tag: 'inbox', ariaRoot: '[role="main"]' }];
        const work = () => page.locator('.bundle-row', { hasText: 'Work' })
            .filter({ hasNot: page.locator('text=Urgent') });
        const urgent = () => page.locator('.bundle-row', { hasText: 'Urgent' });
        const row = text => () => page.locator('tr.zA', { hasText: text });

        await rec.step('inbox-bundled', {
            action: async () => { page = await openInbox(context); rec.watch(page, 'inbox'); },
            checks: [
                eq('one Work bundle row', () => work().count(), 1),
                eq('Work bundle count text', () => work().locator('.bundle-count').textContent(), '(2)'),
                eq('Work senders preview', text(() => work().locator('.bundle-senders')), 'a, b'),
                eq('one combined Work+Urgent bundle', () => urgent().count(), 1),
                eq('combined bundle count text', () => urgent().locator('.bundle-count').textContent(), '(2)'),
                eq('four rows hidden behind bundles', count(P, '.bundled-message'), 4),
                eq('no bundle for the 1-thread Receipts label', count(P, '.bundle-row:has-text("Receipts")'), 0),
                falsy('Lone receipt stays a plain row', hasClass(row('Lone receipt'), 'bundled-message')),
                falsy('Just a message stays a plain row', hasClass(row('Just a message'), 'bundled-message')),
                gte('date dividers (today + 40 days ago)', count(P, '.date-row'), 2),
            ],
            shots,
        });

        await rec.step('open-work-bundle', {
            action: () => work().click(),
            checks: [
                eq('two bundled messages visible', visibleBundledMessages(P), 2),
                truthy('bundle row marked visible', hasClass(work, 'visible')),
                eq('open-bundle backdrop present', count(P, '.bundle-area'), 1),
            ],
            shots,
        });

        await rec.step('collapse-work-bundle', {
            action: () => work().click(),
            checks: [
                eq('no bundled messages visible', visibleBundledMessages(P), 0),
                falsy('bundle row no longer visible', hasClass(work, 'visible')),
            ],
            shots,
        });

        await rec.step('open-combined-then-click-outside', {
            action: async () => {
                await urgent().click();
                await page.locator('.bundled-message.visible').first().waitFor();
                await page.locator('.bundle-area').dispatchEvent('click');
            },
            checks: [
                eq('outside click closed the bundle', visibleBundledMessages(P), 0),
                eq('no bundle row open', count(P, '.bundle-row.visible'), 0),
            ],
            shots,
        });
    },

    async 'bundle-actions'({ context, rec }) {
        await serveInbox(context, inboxPage({
            threads: [
                { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
                { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
                { email: 'c@corp-three.com', subject: 'Outside message' },
            ],
        }));
        let page;
        const P = () => page;
        const shots = () => [{ page, tag: 'inbox', ariaRoot: '[role="main"]' }];
        const work = () => page.locator('.bundle-row', { hasText: 'Work' });
        const action = cls => () => work().locator(cls);
        const checkbox = () => bundleCheckbox(work());
        const toolbarVisible = () => page.locator('.G-Ni').isVisible();

        await rec.step('inbox-bundled', {
            action: async () => { page = await openInbox(context); rec.watch(page, 'inbox'); },
            checks: [
                eq('one Work bundle', () => work().count(), 1),
                eq('nothing selected', rowSelectedCount(P), 0),
                falsy('Gmail toolbar action cluster hidden', toolbarVisible),
                includes('delete-all hidden by default (html class)', htmlClass(P), 'hide-bundle-delete'),
            ],
            shots,
        });

        await rec.step('select-all-via-bundle-checkbox', {
            action: () => checkbox().click(),
            checks: [
                eq('both Work rows selected', rowSelectedCount(P), 2),
                truthy('Gmail toolbar action cluster revealed', toolbarVisible),
                eq('bundle checkbox aria-checked', () => checkbox().getAttribute('aria-checked'), 'true'),
                truthy('bundle row gets Gmail selected styling (x7)', hasClass(work, 'x7')),
            ],
            shots,
        });

        await rec.step('deselect-all-via-bundle-checkbox', {
            action: () => checkbox().click(),
            checks: [
                eq('no rows selected', count(P, 'tr.zA.x7'), 0),
                eq('bundle checkbox aria-checked', () => checkbox().getAttribute('aria-checked'), 'false'),
            ],
            shots,
        });

        await rec.step('partial-selection-indeterminate', {
            action: () => toggleRowCheckbox(page, 'Work 1'),
            checks: [
                eq('bundle checkbox aria-checked', () => checkbox().getAttribute('aria-checked'), 'mixed'),
            ],
            shots,
        });

        // Each bulk action starts from a freshly opened inbox, like the spec:
        // see the fixture gotcha in ../features/bundle-actions.md.
        const freshInbox = async () => {
            await page.close();
            page = await openInbox(context);
            rec.watch(page, 'inbox');
        };

        await rec.step('archive-all', {
            action: async () => {
                await freshInbox();
                await clickBundleAction(work(), '.archive-bundle');
            },
            checks: [
                eq('bundle rows selected for the action', rowSelectedCount(P), 2),
                eventually(includes('Gmail toolbar Archive (act=7) clicked', gmailClicks(P), 'act:7')),
            ],
            shots,
        });

        await rec.step('snooze-all', {
            action: async () => {
                await freshInbox();
                await clickBundleAction(work(), '.snooze-bundle');
            },
            checks: [
                eq('bundle rows selected for the action', rowSelectedCount(P), 2),
                eventually(includes('Gmail toolbar Snooze clicked', gmailClicks(P), 'Snooze')),
            ],
            shots,
        });

        await rec.step('enable-delete-all-live', {
            action: async () => {
                await freshInbox();
                await setSyncOptions(context, { showBundleDelete: true });
                await page.waitForFunction(
                    () => !document.documentElement.classList.contains('hide-bundle-delete'));
            },
            checks: [
                falsy('html still hides delete-all', async () => (await htmlClass(P)()).includes('hide-bundle-delete')),
            ],
            shots,
        });

        await rec.step('delete-all', {
            action: () => clickBundleAction(work(), '.delete-bundle'),
            checks: [
                eq('bundle rows selected for the action', rowSelectedCount(P), 2),
                eventually(includes('Gmail toolbar Delete (act=10) clicked', gmailClicks(P), 'Delete')),
            ],
            shots,
        });

        await rec.step('outside-selection-disables-actions', {
            action: async () => {
                await freshInbox();
                await toggleRowCheckbox(page, 'Outside message');
                await work().hover();
                await work().locator('.snooze-bundle').click();
            },
            checks: [
                truthy('snooze disabled', hasClass(action('.snooze-bundle'), 'disabled')),
                truthy('archive disabled', hasClass(action('.archive-bundle'), 'disabled')),
                truthy('delete disabled', hasClass(action('.delete-bundle'), 'disabled')),
                eq('disabled snooze never reached the toolbar', gmailClicks(P), []),
            ],
            shots,
        });

        await rec.step('restore-defaults', {
            action: async () => {
                await toggleRowCheckbox(page, 'Outside message');
                await setSyncOptions(context, { showBundleDelete: false });
                await page.waitForFunction(
                    () => document.documentElement.classList.contains('hide-bundle-delete'));
            },
            checks: [
                eq('nothing selected', count(P, 'tr.zA.x7'), 0),
                includes('delete-all hidden again', htmlClass(P), 'hide-bundle-delete'),
            ],
            shots,
        });
    },

    async 'sender-bundles'({ context, rec }) {
        await serveInbox(context, inboxPage({
            threads: [
                { email: 'news@acme.com', sender: 'Acme News', subject: 'Newsletter 1' },
                { email: 'billing@acme.com', sender: 'Acme Billing', subject: 'Your invoice' },
                { email: 'jane@gmail.com', sender: 'Jane', subject: 'Hi 1' },
                { email: 'jane@gmail.com', sender: 'Jane', subject: 'Hi 2' },
                { email: 'john@gmail.com', sender: 'John', subject: 'From John' },
                { email: 'team@initech.com', subject: 'Sprint 1', labels: ['Work'] },
                { email: 'team@initech.com', subject: 'Sprint 2', labels: ['Work'] },
                { email: 'extra@initech.com', subject: 'Loose initech mail' },
            ],
        }));
        let page;
        const P = () => page;
        const shots = () => [{ page, tag: 'inbox', ariaRoot: '[role="main"]' }];
        const acme = () => page.locator('.bundle-row', { hasText: 'acme.com' });
        const jane = () => page.locator('.bundle-row', { hasText: 'jane@gmail.com' });
        const row = text => () => page.locator('tr.zA', { hasText: text });

        await rec.step('inbox-bundled', {
            action: async () => { page = await openInbox(context); rec.watch(page, 'inbox'); },
            checks: [
                eq('one acme.com domain bundle', () => acme().count(), 1),
                eq('acme.com bundle count', () => acme().locator('.bundle-count').textContent(), '(2)'),
                eq('one jane@gmail.com address bundle', () => jane().count(), 1),
                eq('jane bundle count', () => jane().locator('.bundle-count').textContent(), '(2)'),
                eq('no john@gmail.com bundle', count(P, '.bundle-row:has-text("john@gmail.com")'), 0),
                falsy('From John stays a plain row', hasClass(row('From John'), 'bundled-message')),
                eq('labeled initech threads form the Work bundle', count(P, '.bundle-row:has-text("Work")'), 1),
                eq('no initech.com sender bundle', count(P, '.bundle-row:has-text("initech.com")'), 0),
                falsy('Loose initech mail stays a plain row', hasClass(row('Loose initech mail'), 'bundled-message')),
                falsy('sender bundle renders uncolored', hasClass(acme, 'label-colored')),
            ],
            shots,
        });

        await rec.step('view-all-links-search-by-sender', {
            action: async () => {},
            checks: [
                includes('acme View all searches from:@acme.com', () => acme().locator('.view-all-link').getAttribute('href'), 'from%3A%40acme.com'),
                includes('jane View all searches from:jane@gmail.com', () => jane().locator('.view-all-link').getAttribute('href'), 'from%3Ajane%40gmail.com'),
            ],
            shots: [],
        });

        await rec.step('open-acme-bundle', {
            action: () => acme().click(),
            checks: [
                eq('two acme threads visible', visibleBundledMessages(P), 2),
                eq('Newsletter 1 is one of them', count(P, '.bundled-message.visible:has-text("Newsletter 1")'), 1),
                eq('Your invoice is the other', count(P, '.bundled-message.visible:has-text("Your invoice")'), 1),
            ],
            shots,
        });

        await rec.step('collapse-acme-bundle', {
            action: () => acme().click(),
            checks: [eq('nothing visible', visibleBundledMessages(P), 0)],
            shots,
        });
    },

    async 'remember-open-bundle'({ context, rec }) {
        await serveInbox(context, inboxPage({
            threads: [
                { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
                { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
                { email: 'c@corp-three.com', subject: 'News 1', labels: ['News'] },
                { email: 'd@corp-four.com', subject: 'News 2', labels: ['News'] },
            ],
        }));
        let page;
        const P = () => page;
        const shots = () => [{ page, tag: 'inbox', ariaRoot: '[role="main"]' }];
        const bundle = name => page.locator('.bundle-row', { hasText: name });
        const storedLabel = async () => {
            const raw = await openBundleStore(P)();
            return raw ? JSON.parse(raw).label : null;
        };

        await rec.step('inbox-bundled', {
            action: async () => { page = await openInbox(context); rec.watch(page, 'inbox'); },
            checks: [
                eq('Work and News bundles', count(P, '.bundle-row'), 2),
                eq('nothing remembered yet', openBundleStore(P), null),
            ],
            shots,
        });

        await rec.step('open-work', {
            action: () => bundle('Work').click(),
            checks: [
                eq('two Work threads visible', visibleBundledMessages(P), 2),
                eq('sessionStorage remembers Work', storedLabel, 'Work'),
            ],
            shots,
        });

        await rec.step('reload-reopens-work', {
            action: async () => {
                await page.reload();
                await page.waitForSelector('.bundle-row.visible', { timeout: 10000 });
            },
            checks: [
                eq('the open bundle after reload is Work', text(() => page.locator('.bundle-row.visible .bundle-and-count')), 'Work (2)'),
                eq('two Work threads visible again', visibleBundledMessages(P), 2),
            ],
            shots,
        });

        await rec.step('collapse-forgets', {
            action: () => bundle('Work').click(),
            checks: [
                eq('nothing visible', visibleBundledMessages(P), 0),
                eq('sessionStorage cleared', openBundleStore(P), null),
            ],
            shots,
        });

        await rec.step('reload-stays-closed', {
            action: async () => {
                await page.reload();
                await page.waitForSelector('.is-bundled', { timeout: 10000 });
            },
            checks: [eq('no bundle open after reload', count(P, '.bundle-row.visible'), 0)],
            shots,
        });

        await rec.step('backdrop-close-forgets', {
            action: async () => {
                await bundle('News').click();
                await page.locator('.bundled-message.visible').first().waitFor();
                await page.locator('.bundle-area').dispatchEvent('click');
            },
            checks: [
                eq('News closed', visibleBundledMessages(P), 0),
                eq('sessionStorage cleared', openBundleStore(P), null),
            ],
            shots,
        });
    },

    async 'options-autosave'({ context, rec, info }) {
        await serveInbox(context, inboxPage({
            threads: [
                { email: 'a@corp-one.com', subject: 'Work 1', labels: ['Work'] },
                { email: 'b@corp-two.com', subject: 'Work 2', labels: ['Work'] },
            ],
        }));
        const optionsUrl = `chrome-extension://${info.extensionId}/options/options.html`;
        let inbox;
        let options;
        const I = () => inbox;
        const shots = () => [
            { page: options, tag: 'options', ariaRoot: 'body' },
            { page: inbox, tag: 'inbox', ariaRoot: '[role="main"]' },
        ];
        const deleteSwitch = () => options.locator('label.switch:has(#show-bundle-delete-checkbox) .slider');
        const deleteChecked = () => options.locator('#show-bundle-delete-checkbox').isChecked();
        const saveStatus = () => options.locator('#save-status');
        const storedSync = () => info.worker.evaluate(
            () => new Promise(resolve => chrome.storage.sync.get(null, resolve)));
        const inboxHidesDelete = async () => (await htmlClass(I)()).includes('hide-bundle-delete');

        await rec.step('open-inbox-and-options', {
            action: async () => {
                inbox = await openInbox(context);
                rec.watch(inbox, 'inbox');
                options = await context.newPage();
                rec.watch(options, 'options');
                await options.goto(optionsUrl);
                await options.locator('#show-bundle-delete-checkbox').waitFor({ state: 'attached' });
            },
            checks: [
                eq('options page shows the pinned extension id', () => options.locator('#extension-id').textContent(), EXPECTED_EXTENSION_ID),
                falsy('delete-all switch off by default', deleteChecked),
                truthy('Gmail tab hides delete-all', inboxHidesDelete),
                eq('sync storage empty in a fresh profile', storedSync, {}),
            ],
            shots,
        });

        await rec.step('flip-delete-all-on', {
            action: async () => {
                await deleteSwitch().click();
                await inbox.waitForFunction(
                    () => !document.documentElement.classList.contains('hide-bundle-delete'));
            },
            checks: [
                truthy('switch now on', deleteChecked),
                truthy('Saved status shown', hasClass(saveStatus, 'visible')),
                eq('only that key was written to sync', storedSync, { showBundleDelete: true }),
                falsy('Gmail tab still hides delete-all', inboxHidesDelete),
            ],
            shots,
        });

        await rec.step('reload-options-persists', {
            action: async () => {
                await options.reload();
                await options.waitForFunction(
                    () => document.getElementById('show-bundle-delete-checkbox').checked);
            },
            checks: [truthy('switch still on after reload', deleteChecked)],
            shots: [{ page: options, tag: 'options', ariaRoot: 'body' }],
        });

        await rec.step('flip-delete-all-off', {
            action: async () => {
                await deleteSwitch().click();
                await inbox.waitForFunction(
                    () => document.documentElement.classList.contains('hide-bundle-delete'));
            },
            checks: [
                falsy('switch off', deleteChecked),
                eq('sync holds the explicit false, nothing else', storedSync, { showBundleDelete: false }),
                truthy('Gmail tab hides delete-all again', inboxHidesDelete),
            ],
            shots,
        });
    },
};

// ---------------------------------------------------------------------------
// Doctor probe: is the built extension loadable and bundling at all?

async function doctor() {
    const { context, cleanup } = await launchWithExtension();
    try {
        await serveInbox(context, inboxPage({
            threads: [
                { email: 'a@corp-one.com', subject: 'Probe 1', labels: ['Probe'] },
                { email: 'b@corp-two.com', subject: 'Probe 2', labels: ['Probe'] },
            ],
        }));
        const page = await openInbox(context);
        const info = await extensionInfo(context);
        const bundles = await page.locator('.bundle-row').count();
        const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'manifest.json'), 'utf8'));
        const idOk = info.extensionId === EXPECTED_EXTENSION_ID;
        const versionOk = info.extensionVersion === manifest.version;
        const bundleOk = bundles === 1;
        console.log(`probe extension id: ${info.extensionId} ${idOk ? '(pinned id, ok)' : `(expected ${EXPECTED_EXTENSION_ID})`}`);
        console.log(`probe extension version: ${info.extensionVersion} ${versionOk ? '(matches dist/manifest.json)' : `(dist/manifest.json says ${manifest.version})`}`);
        console.log(`probe bundle rows on a 2-thread fixture: ${bundles} ${bundleOk ? '(ok)' : '(expected 1)'}`);
        await page.close();
        return idOk && versionOk && bundleOk;
    }
    finally {
        await cleanup();
    }
}

// ---------------------------------------------------------------------------

function usage() {
    console.error('usage: drive.js doctor | drive.js <feature> --evidence <dir>');
    console.error(`features: ${Object.keys(FEATURES).join(', ')}`);
    process.exit(2);
}

async function main(argv) {
    const [command, ...rest] = argv;
    if (!command) {
        usage();
    }
    if (command === 'doctor') {
        const ok = await doctor();
        process.exit(ok ? 0 : 1);
    }
    const walk = FEATURES[command];
    if (!walk) {
        usage();
    }
    const evidenceFlag = rest.indexOf('--evidence');
    const evidenceDir = evidenceFlag >= 0 ? rest[evidenceFlag + 1] : null;
    if (!evidenceDir) {
        usage();
    }

    const rec = new Recorder(path.resolve(evidenceDir), command);
    console.log(`drive ${command} -> ${rec.dir}`);
    const { context, cleanup } = await launchWithExtension();
    let info;
    try {
        info = await extensionInfo(context);
        await walk({ context, rec, info });
    }
    catch (err) {
        rec.steps.push({ index: 'xx', name: 'walk-crashed', checks: [], artifacts: [], pass: false, actionError: String(err && err.stack || err) });
        console.error(err);
    }
    finally {
        await cleanup();
    }
    const pass = rec.finish({
        extensionId: info ? info.extensionId : null,
        extensionVersion: info ? info.extensionVersion : null,
        evidenceDir: rec.dir,
    });
    console.log(`${command}: ${pass ? 'PASS' : 'FAIL'} (${rec.steps.length} steps, see ${path.join(rec.dir, 'walk.md')})`);
    process.exit(pass ? 0 : 1);
}

main(process.argv.slice(2)).catch(err => {
    console.error(err);
    process.exit(1);
});
