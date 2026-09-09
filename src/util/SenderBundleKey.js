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

// A sender bundle groups unlabeled messages that share a sender. Its bundle
// key is the sender id prefixed with the ASCII group separator (0x1D) so it
// can travel through the same label-keyed pipeline as a real label without
// colliding with one — and stays distinct from custom-bundle keys (0x1E) and
// combined-label keys (joined with 0x1F).
//
// The sender id is the sender's domain (so no-reply@acme.com and
// news@acme.com share a bundle), except for freemail domains, where it is the
// full address — strangers on gmail.com must not merge.
const SENDER_BUNDLE_PREFIX = String.fromCharCode(29);

// Domains where the address, not the domain, identifies the sender.
const FREEMAIL_DOMAINS = new Set([
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'yahoo.com',
    'ymail.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'pm.me',
    'gmx.com',
    'gmx.net',
    'gmx.de',
    'mail.com',
    'fastmail.com',
    'hey.com',
    'zoho.com',
    'yandex.com',
    'yandex.ru',
    'qq.com',
    '163.com',
    '126.com',
]);

/**
 * The sender id for an email address: its domain, or the full address for a
 * freemail domain. Returns null for anything without a domain part.
 */
function senderIdForEmail(email) {
    if (typeof email !== 'string') {
        return null;
    }
    const normalized = email.trim().toLowerCase();
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === normalized.length - 1) {
        return null;
    }
    const domain = normalized.slice(atIndex + 1);
    return FREEMAIL_DOMAINS.has(domain) ? normalized : domain;
}

/**
 * The bundle key for a sender bundle with the given sender id.
 */
function senderBundleKey(senderId) {
    return SENDER_BUNDLE_PREFIX + senderId;
}

/**
 * Whether the given bundle key denotes a sender bundle.
 */
function isSenderBundleKey(key) {
    return typeof key === 'string' && key.startsWith(SENDER_BUNDLE_PREFIX);
}

/**
 * The user-facing name for a sender bundle key — the domain or address it
 * groups by. Returns the key unchanged when it isn't a sender-bundle key.
 */
function senderBundleName(key) {
    return isSenderBundleKey(key) ? key.slice(SENDER_BUNDLE_PREFIX.length) : key;
}

export {
    SENDER_BUNDLE_PREFIX,
    senderIdForEmail,
    senderBundleKey,
    isSenderBundleKey,
    senderBundleName,
};
