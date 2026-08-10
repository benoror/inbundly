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

// A custom bundle is a user-defined, ad-hoc grouping of messages that has no
// corresponding Gmail label. Its bundle key is the user's chosen name, prefixed
// with the ASCII record separator (0x1E) so it can travel through the same
// label-keyed pipeline as a real label without ever colliding with one: 0x1E
// never appears in a Gmail label, and is distinct from the unit separator (0x1F)
// used to join combined-label keys.
const CUSTOM_BUNDLE_PREFIX = String.fromCharCode(30);

/**
 * The bundle key for a custom bundle with the given user-facing name.
 */
function customBundleKey(name) {
    return CUSTOM_BUNDLE_PREFIX + name;
}

/**
 * Whether the given bundle key denotes a custom (user-defined) bundle.
 */
function isCustomBundleKey(key) {
    return typeof key === 'string' && key.startsWith(CUSTOM_BUNDLE_PREFIX);
}

/**
 * The user-facing name for a custom bundle key. Returns the key unchanged when
 * it isn't a custom-bundle key.
 */
function customBundleName(key) {
    return isCustomBundleKey(key) ? key.slice(CUSTOM_BUNDLE_PREFIX.length) : key;
}

export {
    CUSTOM_BUNDLE_PREFIX,
    customBundleKey,
    isCustomBundleKey,
    customBundleName,
};
