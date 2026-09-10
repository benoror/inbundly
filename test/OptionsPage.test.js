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

    const exposed = `
        ;globalThis.__options = {
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
        'bundlingEnabled',
        'colorBundlesByLabel',
        'combineLabels',
        'exclude',
        'groupMessagesByDate',
        'keepStarredUnbundled',
        'labels',
        'matchStylusCatppuccin',
        'priorityBundles',
        'rememberOpenBundle',
        'senderBundling',
        'showBundleArchive',
        'showBundleSnooze',
        'showPinnedToggle',
        'skipSingleItemBundles',
    ]);
});

test('the options page groups settings and puts advanced options near the end', () => {
    const categories = [...document.querySelectorAll('.option-category > h2')]
        .map(heading => heading.firstChild.textContent.trim());

    expect(categories).toEqual([
        'Bundling',
        'Bundle setup',
        'Appearance',
        'Features',
        'Advanced',
        'Custom bundles',
        'Sync & backup',
    ]);
});

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
