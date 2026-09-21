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

const PLACEHOLDER = 'Add the name of each bundle on a new line, for example:\n\nBank\nSchool\nNewsletters/*';
const PRIORITY_PLACEHOLDER = 'Add a priority rule on each line, for example:\n\nBank\nSchool/*\nWork + Urgent';

function byId(id) {
    return document.getElementById(id);
}

function splitLines(value) {
    return value.split(/[\n]+/).map(s => s.trim()).filter(s => !!s);
}

/** A boolean option edited by one toggle switch. */
function switchField(id, defaultValue) {
    return {
        controlIds: [id],
        default: defaultValue,
        read: () => byId(id).checked,
        write: value => { byId(id).checked = value; },
    };
}

/**
 * A list option edited as one entry per line. `list: true` makes it save
 * debounced instead of per keystroke.
 */
function listField(id, placeholder) {
    return {
        controlIds: [id],
        list: true,
        default: [],
        read: () => splitLines(byId(id).value),
        write: value => {
            const textarea = byId(id);
            textarea.value = value.join('\n');
            textarea.placeholder = placeholder;
        },
    };
}

// Every option, keyed and defaulted as in OPTION_DEFAULTS in
// src/util/Options.js (this page is plain JS outside the webpack bundle, so
// the keys and defaults are duplicated here; test/OptionsPage.test.js pins
// the two together). Each entry maps a storage key to the form control(s)
// that edit it, a reader for the current form value, and a writer that puts
// a stored value back into the form.
const OPTION_FIELDS = {
    bundlingEnabled: switchField('bundling-enabled-checkbox', true),
    bundleOtherViews: switchField('bundle-other-views-checkbox', false),
    exclude: {
        controlIds: ['exclude-radio', 'include-radio'],
        default: true,
        read: () => byId('exclude-radio').checked,
        write: value => { byId(value ? 'exclude-radio' : 'include-radio').checked = true; },
    },
    labels: listField('label-list', PLACEHOLDER),
    groupMessagesByDate: switchField('group-by-date-checkbox', true),
    combineLabels: switchField('combine-labels-checkbox', true),
    keepStarredUnbundled: switchField('keep-starred-unbundled-checkbox', true),
    priorityBundles: listField('priority-bundles-list', PRIORITY_PLACEHOLDER),
    senderBundling: switchField('sender-bundling-checkbox', true),
    skipSingleItemBundles: switchField('skip-single-item-bundles-checkbox', true),
    rememberOpenBundle: switchField('remember-open-bundle-checkbox', true),
    colorBundlesByLabel: switchField('color-bundles-checkbox', true),
    bundleColorStyle: {
        controlIds: ['color-style-background', 'color-style-accent'],
        default: 'background',
        read: () => document.querySelector('input[name="bundleColorStyle"]:checked').value,
        write: value => {
            byId(value === 'accent' ? 'color-style-accent' : 'color-style-background').checked = true;
        },
    },
    matchStylusCatppuccin: switchField('catppuccin-matching-checkbox', false),
    showPinnedToggle: switchField('show-pinned-toggle-checkbox', false),
    showBundleArchive: switchField('show-bundle-archive-checkbox', true),
    showBundleSnooze: switchField('show-bundle-snooze-checkbox', true),
    showBundleDelete: switchField('show-bundle-delete-checkbox', false),
    skipStarredOnArchive: switchField('skip-starred-on-archive-checkbox', false),
    markReadOnArchive: switchField('mark-read-on-archive-checkbox', false),
    unstarOnArchive: switchField('unstar-on-archive-checkbox', false),
};

const OPTION_KEYS = Object.keys(OPTION_FIELDS);

const OPTION_DEFAULTS = Object.fromEntries(
    OPTION_KEYS.map(key => [key, OPTION_FIELDS[key].default]));

//
// Auto-save
//
// Every control saves its own key the moment it changes; the list textareas
// save shortly after typing stops (and on blur). Only the changed key is
// written, so an untouched option keeps following its default if a future
// version changes that default — the old Save button wrote every key, which
// froze all defaults at their then-current values.

const SAVED_FLASH_MS = 1600;
const LIST_DEBOUNCE_MS = 750;

// When this page wrote last, to tell its own storage.onChanged echo apart
// from a change synced in from another device.
let lastOwnWriteAt = 0;

let savedFlashTimer;
function flashSaved() {
    const status = document.getElementById('save-status');
    status.classList.add('visible');
    clearTimeout(savedFlashTimer);
    savedFlashTimer = setTimeout(() => status.classList.remove('visible'), SAVED_FLASH_MS);
}

function saveOption(key) {
    lastOwnWriteAt = Date.now();
    chrome.storage.sync.set({ [key]: OPTION_FIELDS[key].read() }, flashSaved);
    markChangedFromDefault(key);
}

//
// Defaults on the page
//
// Every switch row says what its default is, and any setting whose value
// differs from the default is marked, so a user can tell a choice they made
// from a default they never touched.

/** The row or block that holds an option's controls. */
function containerFor(key) {
    return byId(OPTION_FIELDS[key].controlIds[0]).closest('.option-row, .option-block');
}

function addDefaultChips() {
    for (const [key, field] of Object.entries(OPTION_FIELDS)) {
        const text = typeof field.default === 'boolean' && field.controlIds.length === 1
            ? containerFor(key).querySelector('.option-text')
            : null;
        if (!text) {
            continue;
        }
        const chip = document.createElement('span');
        chip.className = 'option-default';
        chip.textContent = field.default ? 'Default: on' : 'Default: off';
        text.appendChild(chip);
    }
}

function markChangedFromDefault(key) {
    const field = OPTION_FIELDS[key];
    const differs = JSON.stringify(field.read()) !== JSON.stringify(field.default);
    containerFor(key).classList.toggle('differs', differs);
}

/**
 * An "Advanced" fold that hides a setting the user changed would hide the
 * very thing they came back for, so those open on load.
 */
function openAdvancedWithChanges() {
    for (const details of document.querySelectorAll('details.option-advanced')) {
        if (details.querySelector('.differs')) {
            details.open = true;
        }
    }
}

for (const [key, field] of Object.entries(OPTION_FIELDS)) {
    for (const id of field.controlIds) {
        const control = byId(id);
        if (field.list) {
            let debounceTimer;
            control.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => saveOption(key), LIST_DEBOUNCE_MS);
            });
            control.addEventListener('change', () => {
                clearTimeout(debounceTimer);
                // Normalize the list once editing is done (blur), not while
                // typing — rewriting the value mid-edit would move the cursor.
                control.value = splitLines(control.value).join('\n');
                saveOption(key);
            });
        }
        else {
            control.addEventListener('change', () => saveOption(key));
        }
    }
}

function restoreOptionsForm() {
    chrome.storage.sync.get(OPTION_DEFAULTS, items => {
        for (const [key, field] of Object.entries(OPTION_FIELDS)) {
            field.write(items[key]);
            markChangedFromDefault(key);
        }
        openAdvancedWithChanges();
    });
}

function restoreOptions() {
    restoreOptionsForm();
    renderCustomBundles();
    showExtensionId();
}

//
// Custom bundles management
//
// Custom bundles are created in Gmail (select messages -> "Bundle selected").
// Here we only list them and let the user rename or delete them. We read and
// write chrome.storage.sync directly, matching the versioned shape the content
// script's CustomBundles model persists: { v: 1, bundles: { name: [threadId] } }.
// All options (including these) sync across Chrome / Firefox profiles via
// chrome.storage.sync.

const CUSTOM_BUNDLES_KEY = 'customBundles';

// Refresh the form / custom-bundles list when values change in Gmail or sync
// in from another signed-in Chrome / Firefox profile while this page is open.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') {
        return;
    }
    if (changes[CUSTOM_BUNDLES_KEY]) {
        renderCustomBundles();
    }
    // Any of the options — re-read the whole form so a remote sync doesn't
    // leave stale checkboxes next to newer synced values. Skip the echo of
    // this page's own auto-save: it's redundant, and re-reading would move
    // the cursor in a list the user is still typing in.
    if (OPTION_KEYS.some(key => Object.prototype.hasOwnProperty.call(changes, key)) &&
        Date.now() - lastOwnWriteAt > 1000) {
        restoreOptionsForm();
    }
});


//
// Sync diagnostics & backup
//
// chrome.storage.sync only reaches installs that share one extension ID. An
// unpacked build without a manifest "key" gets an ID derived from its folder
// path, so the same extension on two computers can end up with two separate
// buckets and no sync. Showing the ID makes that visible, and export/import
// moves settings across regardless.

function showExtensionId() {
    const el = document.getElementById('extension-id');
    if (el && chrome.runtime && chrome.runtime.id) {
        el.textContent = chrome.runtime.id;
    }
}

function setBackupStatus(message, isError) {
    const el = document.getElementById('backup-status');
    el.textContent = message || '';
    el.classList.toggle('backup-error', !!isError);
}

function exportSettings() {
    chrome.storage.sync.get(null, items => {
        const payload = {
            app: 'inbundly',
            v: 1,
            exportedAt: new Date().toISOString(),
            settings: items || {},
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inbundly-settings-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        // Revoking synchronously can cancel the download that click() just started.
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        setBackupStatus('Settings exported.');
    });
}

/**
 * Keep only the keys we recognize, so an edited or unrelated file can't write
 * junk into storage. Returns null if there's nothing usable.
 */
function pickImportableSettings(parsed) {
    const source = parsed && parsed.settings ? parsed.settings : parsed;
    if (!source || typeof source !== 'object') {
        return null;
    }

    const settings = {};
    for (const key of OPTION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            settings[key] = source[key];
        }
    }

    const bundles = source[CUSTOM_BUNDLES_KEY] && source[CUSTOM_BUNDLES_KEY].bundles;
    if (bundles && typeof bundles === 'object') {
        const cleaned = {};
        for (const [name, threadIds] of Object.entries(bundles)) {
            if (Array.isArray(threadIds)) {
                cleaned[name] = threadIds.filter(id => typeof id === 'string');
            }
        }
        settings[CUSTOM_BUNDLES_KEY] = { v: 1, bundles: cleaned };
    }

    return Object.keys(settings).length ? settings : null;
}

function importSettings(file) {
    const reader = new FileReader();
    reader.onload = () => {
        let settings;
        try {
            settings = pickImportableSettings(JSON.parse(reader.result));
        }
        catch (e) {
            setBackupStatus("That file isn't valid JSON.", true);
            return;
        }

        if (!settings) {
            setBackupStatus('No Inbundly settings found in that file.', true);
            return;
        }

        chrome.storage.sync.set(settings, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                setBackupStatus(`Import failed: ${error.message}`, true);
                return;
            }
            restoreOptionsForm();
            renderCustomBundles();
            setBackupStatus('Settings imported.');
        });
    };
    reader.onerror = () => setBackupStatus("Couldn't read that file.", true);
    reader.readAsText(file);
}

document.getElementById('export-button').addEventListener('click', exportSettings);
document.getElementById('import-button').addEventListener('click', () => {
    setBackupStatus('');
    document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) {
        importSettings(file);
    }
    // Allow re-importing the same file.
    e.target.value = '';
});

function readCustomBundles(cb) {
    chrome.storage.sync.get({ [CUSTOM_BUNDLES_KEY]: null }, result => {
        const stored = result[CUSTOM_BUNDLES_KEY];
        cb(stored && stored.bundles ? stored.bundles : {});
    });
}

function writeCustomBundles(bundles, cb) {
    chrome.storage.sync.set({ [CUSTOM_BUNDLES_KEY]: { v: 1, bundles } }, cb || (() => {}));
}

function renderCustomBundles() {
    readCustomBundles(bundles => {
        const list = document.getElementById('custom-bundles-list');
        const empty = document.getElementById('custom-bundles-empty');
        list.innerHTML = '';

        const names = Object.keys(bundles).sort((a, b) => a.localeCompare(b));
        empty.style.display = names.length ? 'none' : 'block';

        for (const name of names) {
            const count = bundles[name].length;
            const li = document.createElement('li');
            li.className = 'custom-bundle-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'custom-bundle-name';
            nameSpan.textContent = name;

            const countSpan = document.createElement('span');
            countSpan.className = 'custom-bundle-count';
            countSpan.textContent = `${count} message${count === 1 ? '' : 's'}`;

            const renameButton = document.createElement('button');
            renameButton.className = 'custom-bundle-action';
            renameButton.textContent = 'Rename';
            renameButton.addEventListener('click', () => renameCustomBundle(name));

            const deleteButton = document.createElement('button');
            deleteButton.className = 'custom-bundle-action custom-bundle-delete';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => deleteCustomBundle(name));

            li.appendChild(nameSpan);
            li.appendChild(countSpan);
            li.appendChild(renameButton);
            li.appendChild(deleteButton);
            list.appendChild(li);
        }
    });
}

function renameCustomBundle(name) {
    const to = (window.prompt(`Rename custom bundle "${name}" to:`, name) || '').trim();
    if (!to || to === name) {
        return;
    }
    readCustomBundles(bundles => {
        if (!bundles[name]) {
            return;
        }
        // Merge into an existing target if the new name is already taken.
        const merged = new Set([...(bundles[to] || []), ...bundles[name]]);
        delete bundles[name];
        bundles[to] = [...merged];
        writeCustomBundles(bundles, renderCustomBundles);
    });
}

function deleteCustomBundle(name) {
    if (!window.confirm(
        `Delete the custom bundle "${name}"? The messages themselves aren't affected.`)) {
        return;
    }
    readCustomBundles(bundles => {
        delete bundles[name];
        writeCustomBundles(bundles, renderCustomBundles);
    });
}


//
// Find a setting
//
// Typing in the search box narrows the page to the rows whose text matches,
// together with their section heading and any subsection heading above them
// (so "archive" finds the whole "When Inbundly archives" group, and a
// section's name finds all of it). Sections left with no match fold away,
// an Advanced fold that holds a match opens for the search and goes back to
// how it was when the search is cleared.

const SEARCH_INPUT = byId('options-search');
const SEARCH_ITEMS = '.option-row, .option-block';

let searchActive = false;

function searchText(item, section) {
    const group = item.closest('.option-group, details.option-advanced');
    const heading = group && group.querySelector('h3, summary .option-title');
    return [
        item.textContent,
        heading ? heading.textContent : '',
        section.querySelector('h2').textContent,
    ].join(' ').replace(/\s+/g, ' ').toLowerCase();
}

function filterOptions(rawQuery) {
    const query = rawQuery.trim().replace(/\s+/g, ' ').toLowerCase();
    const folds = document.querySelectorAll('.tab.options details.option-advanced');

    if (query && !searchActive) {
        for (const fold of folds) {
            fold.dataset.openBeforeSearch = fold.open ? '1' : '';
        }
    }
    if (!query && searchActive) {
        for (const fold of folds) {
            fold.open = fold.dataset.openBeforeSearch === '1';
        }
    }
    searchActive = !!query;

    let matches = 0;
    for (const section of document.querySelectorAll('.tab.options .option-category')) {
        let shown = 0;
        for (const item of section.querySelectorAll(SEARCH_ITEMS)) {
            const show = !query || searchText(item, section).includes(query);
            item.classList.toggle('search-hidden', !show);
            shown += show ? 1 : 0;
        }
        for (const group of section.querySelectorAll('.option-group, details.option-advanced')) {
            const hasMatch = !!group.querySelector(`${SEARCH_ITEMS}:not(.search-hidden)`);
            group.classList.toggle('search-hidden', !!query && !hasMatch);
            if (query && hasMatch && group.tagName === 'DETAILS') {
                group.open = true;
            }
        }
        section.classList.toggle('search-hidden', !!query && shown === 0);
        const link = document.querySelector(`.section-nav a[href="#${section.id}"]`);
        if (link) {
            link.classList.toggle('dimmed', !!query && shown === 0);
        }
        matches += shown;
    }

    byId('options-no-matches-query').textContent = rawQuery.trim();
    byId('options-no-matches').hidden = !query || matches > 0;
}

SEARCH_INPUT.addEventListener('input', () => filterOptions(SEARCH_INPUT.value));
SEARCH_INPUT.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        SEARCH_INPUT.value = '';
        filterOptions('');
    }
});

// "/" jumps to the search box from anywhere on the Options tab, as on GitHub.
document.addEventListener('keydown', e => {
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey &&
        currentTab === 'options') {
        e.preventDefault();
        SEARCH_INPUT.focus();
    }
});

//
// Tabs for options page
//
// The hash picks the tab: empty for Options, a tab's name, or the id of an
// element inside a tab (a Get started heading, an Options section), which
// also scrolls there. Anything else lands on Get started.

const TAB_TITLES = {
    'get-started': 'Get started',
    options: 'Options',
    help: 'Help',
};

let currentTab = null;

function tabForHash(hash) {
    if (!hash) {
        return 'options';
    }
    if (TAB_TITLES[hash]) {
        return hash;
    }
    const target = byId(hash);
    const tab = target && target.closest('.tab');
    return tab
        ? Object.keys(TAB_TITLES).find(name => tab.classList.contains(name))
        : 'get-started';
}

function selectTab(name) {
    for (const tab of document.querySelectorAll('main .tab')) {
        tab.style.display = tab.classList.contains(name) ? 'block' : 'none';
    }
    for (const link of document.querySelectorAll('.nav-links a')) {
        link.classList.toggle('active', link.dataset.tab === name);
    }
    document.title = `Inbundly - ${TAB_TITLES[name]}`;

    if (name === 'options' && currentTab !== 'options') {
        restoreOptions();
    }
    currentTab = name;
}

function showTabForHash() {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    selectTab(tabForHash(hash));

    // The browser skipped its own scroll if the target was still hidden.
    const target = hash && !TAB_TITLES[hash] ? byId(hash) : null;
    if (target) {
        target.scrollIntoView({ block: 'start' });
    }
    else {
        window.scrollTo(0, 0);
    }
}

addDefaultChips();
showTabForHash();
window.addEventListener('hashchange', showTabForHash);
