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
 * Defaults and key groups for inbundly options persisted in chrome.storage.sync
 * (Firefox Sync via the same API). Custom bundles use a separate key
 * (`customBundles`) managed by containers/CustomBundles.js.
 */
const OPTION_DEFAULTS = {
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
};

const OPTION_KEYS = Object.keys(OPTION_DEFAULTS);

/** Options that affect how the message list is bundled / styled. */
const BUNDLING_OPTION_KEYS = [
    'exclude',
    'labels',
    'combineLabels',
    'keepStarredUnbundled',
    'priorityBundles',
    'groupMessagesByDate',
    'skipSingleItemBundles',
    'colorBundlesByLabel',
    'bundleColorStyle',
    'matchStylusCatppuccin',
];

/** Options that only toggle injected UI chrome (CSS classes on <html>). */
const UI_OPTION_KEYS = [
    'showPinnedToggle',
    'showBundleArchive',
];

/**
 * True if `changes` (a chrome.storage.onChanged map) includes any of `keys`.
 */
function changesInclude(changes, keys) {
    return keys.some(key => Object.prototype.hasOwnProperty.call(changes, key));
}

/**
 * Pull the new values for `keys` out of a chrome.storage.onChanged map,
 * falling back to `OPTION_DEFAULTS` when a key was removed (newValue undefined).
 */
function optionsFromChanges(changes, keys) {
    const options = {};
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(changes, key)) {
            continue;
        }
        const { newValue } = changes[key];
        options[key] = newValue === undefined ? OPTION_DEFAULTS[key] : newValue;
    }
    return options;
}

export {
    OPTION_DEFAULTS,
    OPTION_KEYS,
    BUNDLING_OPTION_KEYS,
    UI_OPTION_KEYS,
    changesInclude,
    optionsFromChanges,
};
