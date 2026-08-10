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
    customBundleKey,
    isCustomBundleKey,
    customBundleName,
} from '../src/util/CustomBundleKey';
import { LABEL_SET_SEPARATOR } from '../src/util/Constants';

test('a custom bundle key round-trips back to its name', () => {
    const key = customBundleKey('Trip planning');
    expect(isCustomBundleKey(key)).toBe(true);
    expect(customBundleName(key)).toBe('Trip planning');
});

test('a real label is not mistaken for a custom bundle key', () => {
    expect(isCustomBundleKey('Newsletters')).toBe(false);
    expect(isCustomBundleKey('Newsletters/Tech')).toBe(false);
});

test('a combined-label key is not mistaken for a custom bundle key', () => {
    const combined = ['Work', 'Urgent'].join(LABEL_SET_SEPARATOR);
    expect(isCustomBundleKey(combined)).toBe(false);
});

test('customBundleName returns a non-custom key unchanged', () => {
    expect(customBundleName('Newsletters')).toBe('Newsletters');
});

test('the custom prefix is distinct from the combined-label separator', () => {
    const key = customBundleKey('x');
    expect(key.includes(LABEL_SET_SEPARATOR)).toBe(false);
});

test('names containing spaces or slashes survive the round-trip', () => {
    const name = 'IH/Kamek + follow ups';
    expect(customBundleName(customBundleKey(name))).toBe(name);
});
