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

// Every option, keyed as in OPTION_DEFAULTS in src/util/Options.js (this page
// is plain JS outside the webpack bundle, so the keys are duplicated here —
// keep the two in sync). Each entry maps a storage key to the form control(s)
// that edit it and a reader for the current form value. `list: true` marks the
// free-text list textareas, which save debounced instead of per keystroke.
const OPTION_FIELDS = {
    bundlingEnabled: { controlIds: ['bundling-enabled-checkbox'],
        read: () => document.getElementById('bundling-enabled-checkbox').checked },
    exclude: { controlIds: ['exclude-radio', 'include-radio'],
        read: () => document.getElementById('exclude-radio').checked },
    labels: { controlIds: ['label-list'], list: true,
        read: () => splitLines(document.getElementById('label-list').value) },
    groupMessagesByDate: { controlIds: ['group-by-date-checkbox'],
        read: () => document.getElementById('group-by-date-checkbox').checked },
    combineLabels: { controlIds: ['combine-labels-checkbox'],
        read: () => document.getElementById('combine-labels-checkbox').checked },
    keepStarredUnbundled: { controlIds: ['keep-starred-unbundled-checkbox'],
        read: () => document.getElementById('keep-starred-unbundled-checkbox').checked },
    priorityBundles: { controlIds: ['priority-bundles-list'], list: true,
        read: () => splitLines(document.getElementById('priority-bundles-list').value) },
    skipSingleItemBundles: { controlIds: ['skip-single-item-bundles-checkbox'],
        read: () => document.getElementById('skip-single-item-bundles-checkbox').checked },
    colorBundlesByLabel: { controlIds: ['color-bundles-checkbox'],
        read: () => document.getElementById('color-bundles-checkbox').checked },
    bundleColorStyle: { controlIds: ['color-style-background', 'color-style-accent'],
        read: () => document.querySelector('input[name="bundleColorStyle"]:checked').value },
    matchStylusCatppuccin: { controlIds: ['catppuccin-matching-checkbox'],
        read: () => document.getElementById('catppuccin-matching-checkbox').checked },
    showPinnedToggle: { controlIds: ['show-pinned-toggle-checkbox'],
        read: () => document.getElementById('show-pinned-toggle-checkbox').checked },
    showBundleArchive: { controlIds: ['show-bundle-archive-checkbox'],
        read: () => document.getElementById('show-bundle-archive-checkbox').checked },
};

const OPTION_KEYS = Object.keys(OPTION_FIELDS);

function splitLines(value) {
    return value.split(/[\n]+/).map(s => s.trim()).filter(s => !!s);
}

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
}

for (const [key, field] of Object.entries(OPTION_FIELDS)) {
    for (const id of field.controlIds) {
        const control = document.getElementById(id);
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
    chrome.storage.sync.get({
        bundlingEnabled: true,
        exclude: true,
        labels: [],
        groupMessagesByDate: true,
        combineLabels: true,
        keepStarredUnbundled: true,
        priorityBundles: [],
        skipSingleItemBundles: true,
        colorBundlesByLabel: true,
        bundleColorStyle: 'background',
        matchStylusCatppuccin: false,
        showPinnedToggle: false,
        showBundleArchive: true,
    }, function(items) {
        document.getElementById('bundling-enabled-checkbox').checked = items.bundlingEnabled;

        const id = items.exclude ? 'exclude-radio' : 'include-radio';
        document.getElementById(id).checked = true;

        const labelList = document.getElementById('label-list');
        labelList.value = items.labels.join('\n');
        if (!items.labels.length) {
          labelList.placeholder = PLACEHOLDER;
        }

        document.getElementById('group-by-date-checkbox').checked = items.groupMessagesByDate;
        document.getElementById('combine-labels-checkbox').checked = items.combineLabels;
        document.getElementById('keep-starred-unbundled-checkbox').checked =
            items.keepStarredUnbundled;
        const priorityList = document.getElementById('priority-bundles-list');
        priorityList.value = items.priorityBundles.join('\n');
        priorityList.placeholder = PRIORITY_PLACEHOLDER;
        document.getElementById('skip-single-item-bundles-checkbox').checked = items.skipSingleItemBundles;
        document.getElementById('color-bundles-checkbox').checked = items.colorBundlesByLabel;

        const styleId = items.bundleColorStyle === 'accent'
            ? 'color-style-accent'
            : 'color-style-background';
        document.getElementById(styleId).checked = true;

        document.getElementById('catppuccin-matching-checkbox').checked = items.matchStylusCatppuccin;
        document.getElementById('show-pinned-toggle-checkbox').checked = items.showPinnedToggle;
        document.getElementById('show-bundle-archive-checkbox').checked = items.showBundleArchive;

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
// Tabs for options page
//

function selectTab(tabIndex, subtitle) {
    const tabs = [...document.querySelectorAll('main .tab')];
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].style.display = i === tabIndex ? 'block' : 'none';
    }

    const tabLinks = [...document.querySelectorAll('.nav-links li')];
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].style.fontWeight = i === tabIndex ? '700' : '';
    }

    document.querySelector('title').innerText = `Inbundly - `;
}

document.querySelectorAll('.nav-links li').forEach((e, i) => {
    e.addEventListener('click', () => selectTab(i, e.innerText));
});

function initializeTab() {
    // Set the initial tab, based on the hash
    const parts = window.location.href.split('#');
    if (parts.length < 2 || parts[1].length === 0) {
        selectTab(1, 'Options');
        restoreOptions();
    }
    else if (parts[1] === 'help') {
        selectTab(2, 'Help');
    }
    else {
        selectTab(0, 'Get started');
    }
}

initializeTab();
window.addEventListener('hashchange', initializeTab);
