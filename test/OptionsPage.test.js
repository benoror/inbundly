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
            saveOptions,
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

test('saving writes every known option key', () => {
    document.getElementById('priority-bundles-list').value = 'School/*';
    document.getElementById('keep-starred-unbundled-checkbox').checked = false;
    document.getElementById('save-button').click();

    for (const key of internals.OPTION_KEYS) {
        expect(store).toHaveProperty(key);
    }
    expect(store.priorityBundles).toEqual(['School/*']);
    expect(store.keepStarredUnbundled).toBe(false);
});

test('the options page groups settings and puts advanced options near the end', () => {
    const categories = [...document.querySelectorAll('.option-category > h2')]
        .map(heading => heading.firstChild.textContent.trim());

    expect(categories).toEqual([
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
