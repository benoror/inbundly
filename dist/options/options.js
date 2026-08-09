// inboxy: Chrome extension for Google Inbox-style bundles in Gmail.
// Copyright (C) 2020  Teresa Ou

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

// The Save-button options. Mirrors OPTION_DEFAULTS in src/util/Options.js; this
// page is plain JS outside the webpack bundle, so the list is duplicated here.
const OPTION_KEYS = [
    'exclude',
    'labels',
    'groupMessagesByDate',
    'combineLabels',
    'keepStarredUnbundled',
    'priorityBundles',
    'skipSingleItemBundles',
    'colorBundlesByLabel',
    'bundleColorStyle',
    'matchStylusCatppuccin',
    'showPinnedToggle',
    'showBundleArchive',
];

function saveOptions() {
    const exclude = document.getElementById('exclude-radio').checked;
    const labelList = document.getElementById('label-list');
    const labels = labelList.value.split(/[\n]+/).map(s => s.trim()).filter(s => !!s);
    const groupMessagesByDate = document.getElementById('group-by-date-checkbox').checked;
    const combineLabels = document.getElementById('combine-labels-checkbox').checked;
    const keepStarredUnbundled =
        document.getElementById('keep-starred-unbundled-checkbox').checked;
    const priorityList = document.getElementById('priority-bundles-list');
    const priorityBundles = priorityList.value.split(/[\n]+/).map(s => s.trim()).filter(s => !!s);
    const skipSingleItemBundles = document.getElementById('skip-single-item-bundles-checkbox').checked;
    const colorBundlesByLabel = document.getElementById('color-bundles-checkbox').checked;
    const bundleColorStyle = document.querySelector('input[name="bundleColorStyle"]:checked').value;
    const matchStylusCatppuccin = document.getElementById('catppuccin-matching-checkbox').checked;
    const showPinnedToggle = document.getElementById('show-pinned-toggle-checkbox').checked;
    const showBundleArchive = document.getElementById('show-bundle-archive-checkbox').checked;

    chrome.storage.sync.set({
        exclude: !!exclude,
        labels: labels,
        groupMessagesByDate: !!groupMessagesByDate,
        combineLabels: !!combineLabels,
        keepStarredUnbundled: !!keepStarredUnbundled,
        priorityBundles: priorityBundles,
        skipSingleItemBundles: !!skipSingleItemBundles,
        colorBundlesByLabel: !!colorBundlesByLabel,
        bundleColorStyle: bundleColorStyle,
        matchStylusCatppuccin: !!matchStylusCatppuccin,
        showPinnedToggle: !!showPinnedToggle,
        showBundleArchive: !!showBundleArchive,
    }, function() {
        labelList.value = labels.join('\n');
        priorityList.value = priorityBundles.join('\n');

        const saveButton = document.getElementById('save-button');
        saveButton.classList.add('saved');
        setTimeout(() => {
            saveButton.classList.remove('saved');
        }, 3000);
    });
}

function restoreOptionsForm() {
    chrome.storage.sync.get({
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
        showBundleArchive: false,
    }, function(items) {
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
    // Any of the Save-button options — re-read the whole form so a remote
    // sync doesn't leave stale checkboxes next to newer synced values.
    if (OPTION_KEYS.some(key => Object.prototype.hasOwnProperty.call(changes, key))) {
        restoreOptionsForm();
    }
});
document.getElementById('save-button').addEventListener('click', saveOptions);


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
            setBackupStatus('No inboxy settings found in that file.', true);
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

    document.querySelector('title').innerText = `inboxy - ${subtitle}`;
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
