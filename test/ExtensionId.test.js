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

/**
 * chrome.storage.sync is partitioned per extension ID, so the manifest key is
 * what lets one user's laptops share settings. Pin the resulting ID here: if
 * the key ever changes, every stored option and custom bundle becomes
 * unreachable, and this test should be what makes that deliberate.
 *
 * Chrome derives the ID by mapping the first 16 bytes of the SHA-256 of the
 * DER-encoded public key, nibble by nibble, onto 'a'-'p'.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'dist', 'manifest.json'), 'utf8'));

const EXPECTED_ID = 'cpggdbckpaoikhddngoeepdedfkleiab';

function extensionIdFromKey(keyBase64) {
    const der = Buffer.from(keyBase64, 'base64');
    const digest = crypto.createHash('sha256').update(der).digest('hex');
    return [...digest.slice(0, 32)]
        .map(c => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16)))
        .join('');
}

test('the manifest pins the extension ID that settings sync under', () => {
    expect(manifest.key).toBeDefined();
    expect(extensionIdFromKey(manifest.key)).toBe(EXPECTED_ID);
});

test('the pinned ID is a well-formed Chrome extension ID', () => {
    expect(EXPECTED_ID).toMatch(/^[a-p]{32}$/);
});

test('Firefox gets a stable add-on id too, since storage.sync needs one', () => {
    expect(manifest.browser_specific_settings.gecko.id).toBeTruthy();
});

test('the documented ID matches the manifest', () => {
    for (const doc of ['README.md', 'CLAUDE.md']) {
        const text = fs.readFileSync(path.join(__dirname, '..', doc), 'utf8');
        expect(text).toContain(EXPECTED_ID);
    }
});
