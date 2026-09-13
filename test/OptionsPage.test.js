// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Runs the real dist/options/options.js against the real options.html markup in
 * jsdom. The options page is plain, hand-committed JS outside the webpack
 * bundle, so nothing else would catch a syntax slip or a missing element id —
 * and a throw there takes down every setting on the page.
 */

const fs = require('fs');
const path = require('path');
const { OPTION_DEFAULTS } = require('../src/util/Options');

const OPTIONS_DIR = path.join(__dirname, '..', 'dist', 'options');
const HTML = fs.readFileSync(path.join(OPTIONS_DIR, 'options.html'), 'utf8');
const SCRIPT = fs.readFileSync(path.join(OPTIONS_DIR, 'options.js'), 'utf8');

const EXTENSION_ID = 'cpggdbckpaoikhddngoeepdedfkleiab';

let store;
let internals;

/**
 * Load the options page markup and script into jsdom with a fake
 * chrome.storage.sync, returning the script's internal functions.
 */
function loadOptionsPage(initialStore = {}) {
    store = { ...initialStore };

    global.chrome = {
        runtime: { id: EXTENSION_ID, lastError: null },
        storage: {
            sync: {
                get(keys, cb) {
                    if (keys === null || keys === undefined) {
                        cb({ ...store });
                        return;
                    }
                    const result = {};
                    const defaults = Array.isArray(keys)
                        ? Object.fromEntries(keys.map(k => [k, undefined]))
                        : keys;
                    for (const [key, fallback] of Object.entries(defaults)) {
                        result[key] = key in store ? store[key] : fallback;
                    }
                    cb(result);
                },
                set(items, cb) {
                    Object.assign(store, items);
                    if (cb) {
                        cb();
                    }
                },
            },
            onChanged: { addListener: () => {} },
        },
    };

    document.head.innerHTML = '<title>Inbundly</title>';
    document.body.innerHTML = HTML.replace(/[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*/, '');
    // jsdom has no layout, so scrolling is a no-op here.
    window.scrollTo = () => {};
    window.Element.prototype.scrollIntoView = () => {};
    window.location.hash = '';

    const exposed = `
        ;globalThis.__options = {
            OPTION_DEFAULTS,
            OPTION_FIELDS,
            OPTION_KEYS,
            pickImportableSettings,
            restoreOptionsForm,
            saveOption,
        };`;
    // eslint-disable-next-line no-eval
    eval(SCRIPT + exposed);
    return globalThis.__options;
}

beforeEach(() => {
    internals = loadOptionsPage({ priorityBundles: ['Bank', 'Work + Urgent'] });
});

test('the options page loads and restores stored values without throwing', () => {
    expect(internals).toBeDefined();
    expect(document.getElementById('priority-bundles-list').value)
        .toBe('Bank\nWork + Urgent');
    expect(document.getElementById('keep-starred-unbundled-checkbox').checked).toBe(true);
    expect(document.getElementById('show-bundle-delete-checkbox').checked).toBe(false);
    expect(document.getElementById('bundle-other-views-checkbox').checked).toBe(false);
    // The archive switches start off: archive-all sweeps as it always has.
    expect(document.getElementById('skip-starred-on-archive-checkbox').checked).toBe(false);
    expect(document.getElementById('mark-read-on-archive-checkbox').checked).toBe(false);
    expect(document.getElementById('unstar-on-archive-checkbox').checked).toBe(false);
});

test('each archive switch saves only its own key', () => {
    const skip = document.getElementById('skip-starred-on-archive-checkbox');
    skip.checked = true;
    skip.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(store.skipStarredOnArchive).toBe(true);
    expect(store).not.toHaveProperty('markReadOnArchive');
    expect(store).not.toHaveProperty('unstarOnArchive');

    const markRead = document.getElementById('mark-read-on-archive-checkbox');
    markRead.checked = true;
    markRead.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(store.markReadOnArchive).toBe(true);

    const unstar = document.getElementById('unstar-on-archive-checkbox');
    unstar.checked = true;
    unstar.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(store.unstarOnArchive).toBe(true);
});

test('stored archive switches are restored into the form', () => {
    loadOptionsPage({ markReadOnArchive: true, unstarOnArchive: true });

    expect(document.getElementById('skip-starred-on-archive-checkbox').checked).toBe(false);
    expect(document.getElementById('mark-read-on-archive-checkbox').checked).toBe(true);
    expect(document.getElementById('unstar-on-archive-checkbox').checked).toBe(true);
});

test('bundling outside the inbox is an opt-in switch that saves its own key', () => {
    const checkbox = document.getElementById('bundle-other-views-checkbox');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(store.bundleOtherViews).toBe(true);
    expect(store).not.toHaveProperty('bundlingEnabled');
});

test('the extension id is displayed, since sync depends on it matching', () => {
    expect(document.getElementById('extension-id').textContent).toBe(EXTENSION_ID);
});

test('changing a checkbox auto-saves only that key', () => {
    const checkbox = document.getElementById('keep-starred-unbundled-checkbox');
    checkbox.checked = false;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

    // Only the changed key is written — an untouched option must keep
    // following its default, so writing every key (the old Save button
    // behavior) would be a regression.
    expect(store).toEqual({
        priorityBundles: ['Bank', 'Work + Urgent'],
        keepStarredUnbundled: false,
    });
    expect(document.getElementById('save-status').classList.contains('visible')).toBe(true);
});

test('a list textarea auto-saves and normalizes on change', () => {
    const list = document.getElementById('priority-bundles-list');
    list.value = '  School/*  \n\n\nBank ';
    list.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(store.priorityBundles).toEqual(['School/*', 'Bank']);
    expect(list.value).toBe('School/*\nBank');
    expect(store).not.toHaveProperty('keepStarredUnbundled');
});

test('typing in a list textarea saves after the debounce delay', () => {
    jest.useFakeTimers();
    try {
        const list = document.getElementById('label-list');
        list.value = 'Newsletters';
        list.dispatchEvent(new window.Event('input', { bubbles: true }));

        expect(store).not.toHaveProperty('labels');
        jest.advanceTimersByTime(1000);
        expect(store.labels).toEqual(['Newsletters']);
    }
    finally {
        jest.useRealTimers();
    }
});

test('every option key has an auto-save field', () => {
    // OPTION_KEYS is derived from the field map, so this pins the full list
    // against src/util/Options.js OPTION_DEFAULTS.
    expect([...internals.OPTION_KEYS].sort()).toEqual([
        'bundleColorStyle',
        'bundleOtherViews',
        'bundlingEnabled',
        'colorBundlesByLabel',
        'combineLabels',
        'exclude',
        'groupMessagesByDate',
        'keepStarredUnbundled',
        'labels',
        'markReadOnArchive',
        'matchStylusCatppuccin',
        'priorityBundles',
        'rememberOpenBundle',
        'senderBundling',
        'showBundleArchive',
        'showBundleDelete',
        'showBundleSnooze',
        'showPinnedToggle',
        'skipSingleItemBundles',
        'skipStarredOnArchive',
        'unstarOnArchive',
    ]);
});

test('the page restores with the same defaults the content script uses', () => {
    // The page duplicates OPTION_DEFAULTS because it lives outside the webpack
    // bundle; a default that drifts here would show one state on the page and
    // another in Gmail.
    expect(internals.OPTION_DEFAULTS).toEqual(OPTION_DEFAULTS);
});

test('radio and list options restore from storage too', () => {
    loadOptionsPage({ exclude: false, bundleColorStyle: 'accent', labels: ['Work', 'Bank'] });

    expect(document.getElementById('include-radio').checked).toBe(true);
    expect(document.getElementById('color-style-accent').checked).toBe(true);
    expect(document.getElementById('label-list').value).toBe('Work\nBank');
});

test('the options page groups settings by topic, in the order of the section links', () => {
    const categories = [...document.querySelectorAll('.option-category')];
    const headings = categories.map(section => section.querySelector('h2').textContent.trim());

    expect(headings).toEqual([
        'Bundling',
        'Labels',
        'Inbox layout',
        'Pinned messages',
        'Bundle actions',
        'Appearance',
        'Custom bundles',
        'Sync & backup',
    ]);

    // Every section is reachable from the jump links, and each has a one-line lead.
    const linked = [...document.querySelectorAll('.section-nav a')]
        .map(link => link.getAttribute('href').slice(1));
    expect(linked).toEqual(categories.map(section => section.id));
    for (const section of categories) {
        expect(section.querySelector('.option-lead').textContent.trim()).not.toBe('');
    }
});

test('every switch sits in a row with a title, an explanation, and its default', () => {
    for (const input of document.querySelectorAll('.tab.options input[type="checkbox"]')) {
        const row = input.closest('.option-row');
        expect(row).not.toBeNull();
        expect(row.querySelector(`label.option-title[for="${input.id}"]`)).not.toBeNull();
        expect(row.querySelector('.option-detail').textContent.trim()).not.toBe('');
        expect(row.querySelector('.option-default').textContent)
            .toBe(OPTION_DEFAULTS[keyForControl(input.id)] ? 'Default: on' : 'Default: off');
    }
});

test('the bulk actions and their archive behavior share one section', () => {
    const section = document.getElementById('bundle-actions');
    const ids = [...section.querySelectorAll('input[type="checkbox"]')].map(input => input.id);

    expect(ids).toEqual([
        'show-bundle-archive-checkbox',
        'show-bundle-snooze-checkbox',
        'show-bundle-delete-checkbox',
        'skip-starred-on-archive-checkbox',
        'mark-read-on-archive-checkbox',
        'unstar-on-archive-checkbox',
    ]);
});

test('a setting that differs from its default is marked, and its fold opens', () => {
    loadOptionsPage({ combineLabels: false, showBundleDelete: true });

    const combine = document.getElementById('combine-labels-checkbox').closest('.option-row');
    expect(combine.classList.contains('differs')).toBe(true);
    expect(document.getElementById('label-rules').open).toBe(true);
    expect(document.getElementById('theme-matching').open).toBe(false);

    expect(document.getElementById('show-bundle-delete-checkbox').closest('.option-row')
        .classList.contains('differs')).toBe(true);
    expect(document.getElementById('show-bundle-snooze-checkbox').closest('.option-row')
        .classList.contains('differs')).toBe(false);

    // Flipping a switch back to its default clears the mark straight away.
    const del = document.getElementById('show-bundle-delete-checkbox');
    del.checked = false;
    del.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(del.closest('.option-row').classList.contains('differs')).toBe(false);
});

test('the hash picks the tab, and a section id lands on Options', () => {
    const shown = () => [...document.querySelectorAll('main .tab')]
        .filter(tab => tab.style.display !== 'none')
        .map(tab => tab.classList[1]);

    expect(shown()).toEqual(['options']);
    expect(document.title).toBe('Inbundly - Options');

    window.location.hash = '#help';
    window.dispatchEvent(new window.Event('hashchange'));
    expect(shown()).toEqual(['help']);

    window.location.hash = '#bundle-actions';
    window.dispatchEvent(new window.Event('hashchange'));
    expect(shown()).toEqual(['options']);

    window.location.hash = '#create-filters';
    window.dispatchEvent(new window.Event('hashchange'));
    expect(shown()).toEqual(['get-started']);
    expect(document.querySelector('.nav-links a.active').dataset.tab).toBe('get-started');
});

test('the page carries no em dashes in its copy', () => {
    expect(HTML).not.toMatch(/\u2014|&mdash;/);
});

function keyForControl(id) {
    return Object.keys(OPTION_DEFAULTS).find(key => {
        const field = internals.OPTION_FIELDS[key];
        return field.controlIds.includes(id);
    });
}

test('import keeps known keys and drops anything else', () => {
    const picked = internals.pickImportableSettings({
        app: 'inbundly',
        v: 1,
        settings: {
            priorityBundles: ['ImportedRule'],
            combineLabels: false,
            somethingElse: 'nope',
        },
    });

    expect(picked).toEqual({ priorityBundles: ['ImportedRule'], combineLabels: false });
});

test('import accepts a bare settings object and sanitizes custom bundles', () => {
    const picked = internals.pickImportableSettings({
        labels: ['Work'],
        customBundles: { v: 1, bundles: { Trip: ['abc', 5, null], Bad: 'nope' } },
    });

    expect(picked.labels).toEqual(['Work']);
    expect(picked.customBundles).toEqual({ v: 1, bundles: { Trip: ['abc'] } });
});

test('import rejects a file with nothing recognizable', () => {
    expect(internals.pickImportableSettings({ hello: 'world' })).toBeNull();
    expect(internals.pickImportableSettings(null)).toBeNull();
    expect(internals.pickImportableSettings('a string')).toBeNull();
});

test('exporting produces JSON holding the current settings', () => {
    const captured = [];
    global.Blob = class {
        constructor(parts) {
            captured.push(parts.join(''));
        }
    };
    global.URL.createObjectURL = () => 'blob:fake';
    global.URL.revokeObjectURL = () => {};

    document.getElementById('export-button').click();

    expect(captured).toHaveLength(1);
    const payload = JSON.parse(captured[0]);
    expect(payload.app).toBe('inbundly');
    expect(payload.settings.priorityBundles).toEqual(['Bank', 'Work + Urgent']);
    expect(document.getElementById('backup-status').textContent).toBe('Settings exported.');
});
