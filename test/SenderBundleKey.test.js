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

import {
    senderIdForEmail,
    senderBundleKey,
    isSenderBundleKey,
    senderBundleName,
} from '../src/util/SenderBundleKey';
import { customBundleKey, CUSTOM_BUNDLE_PREFIX } from '../src/util/CustomBundleKey';
import { LABEL_SET_SEPARATOR } from '../src/util/Constants';

test('a corporate sender groups by domain', () => {
    expect(senderIdForEmail('no-reply@acme.com')).toBe('acme.com');
    expect(senderIdForEmail('News@Acme.com')).toBe('acme.com');
});

test('a freemail sender groups by the full address', () => {
    expect(senderIdForEmail('jane.doe@gmail.com')).toBe('jane.doe@gmail.com');
    expect(senderIdForEmail('Jane.Doe@Outlook.com')).toBe('jane.doe@outlook.com');
});

test('an address without a usable domain has no sender id', () => {
    expect(senderIdForEmail('not-an-email')).toBeNull();
    expect(senderIdForEmail('@acme.com')).toBeNull();
    expect(senderIdForEmail('jane@')).toBeNull();
    expect(senderIdForEmail(null)).toBeNull();
});

test('a sender bundle key round-trips back to its id', () => {
    const key = senderBundleKey('acme.com');
    expect(isSenderBundleKey(key)).toBe(true);
    expect(senderBundleName(key)).toBe('acme.com');
});

test('labels and other bundle keys are not mistaken for sender keys', () => {
    expect(isSenderBundleKey('Newsletters')).toBe(false);
    expect(isSenderBundleKey(['Work', 'Urgent'].join(LABEL_SET_SEPARATOR))).toBe(false);
    expect(isSenderBundleKey(customBundleKey('acme.com'))).toBe(false);
});

test('a sender key is not mistaken for a custom bundle key', () => {
    expect(senderBundleKey('acme.com').startsWith(CUSTOM_BUNDLE_PREFIX)).toBe(false);
});

test('the sender prefix is distinct from the combined-label separator', () => {
    expect(senderBundleKey('acme.com').includes(LABEL_SET_SEPARATOR)).toBe(false);
});

test('senderBundleName returns a non-sender key unchanged', () => {
    expect(senderBundleName('Newsletters')).toBe('Newsletters');
});
