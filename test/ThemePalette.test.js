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

import { detectThemeFlavor, flavorBase, snapToAccent, isNeutral } from '../src/util/ThemePalette';

//
// isNeutral
//

test('isNeutral - true for gray-ish colors, false for colorful ones', () => {
    expect(isNeutral('rgb(231, 231, 231)')).toBe(true);
    expect(isNeutral('rgb(67, 67, 67)')).toBe(true);
    expect(isNeutral('rgb(66, 214, 146)')).toBe(false); // green
    expect(isNeutral('rgb(30, 102, 245)')).toBe(false);  // blue
    expect(isNeutral('')).toBe(false);
});

//
// detectThemeFlavor
//

// The Catppuccin Latte+Frappé auto build ships both bases in the CSS.
const LIGHT_DARK_CSS = 'body{background:#eff1f5} @media(prefers-color-scheme:dark){body{background:#303446}}';

test('detectThemeFlavor - picks the light flavor when the scheme is light', () => {
    expect(detectThemeFlavor(LIGHT_DARK_CSS, false)).toBe('latte');
});

test('detectThemeFlavor - picks the dark flavor when the scheme is dark', () => {
    expect(detectThemeFlavor(LIGHT_DARK_CSS, true)).toBe('frappe');
});

test('detectThemeFlavor - single-flavor build is detected regardless of scheme', () => {
    expect(detectThemeFlavor('body{background:#1e1e2e}', false)).toBe('mocha');
});

test('detectThemeFlavor - returns null when no Catppuccin base is present', () => {
    expect(detectThemeFlavor('body{background:#ffffff}', false)).toBeNull();
    expect(detectThemeFlavor('', true)).toBeNull();
});

//
// snapToAccent
//

test('snapToAccent - an exact accent snaps to itself', () => {
    // Latte blue #1e66f5
    expect(snapToAccent('rgb(30, 102, 245)', 'latte')).toBe('rgb(30, 102, 245)');
});

test('snapToAccent - a near color snaps to the closest accent', () => {
    // Close to Latte red #d20f39 -> rgb(210, 15, 57)
    expect(snapToAccent('rgb(205, 20, 60)', 'latte')).toBe('rgb(210, 15, 57)');
});

test('snapToAccent - unparseable input is returned unchanged', () => {
    expect(snapToAccent('', 'latte')).toBe('');
    expect(snapToAccent('rgb(1,2,3)', 'unknownflavor')).toBe('rgb(1,2,3)');
});

test('snapToAccent - near-gray colors map to the neutral tone, not an accent', () => {
    // Latte neutral (overlay1) #7c7f93 -> rgb(124, 127, 147)
    expect(snapToAccent('rgb(231, 231, 231)', 'latte')).toBe('rgb(124, 127, 147)');
    expect(snapToAccent('rgb(67, 67, 67)', 'latte')).toBe('rgb(124, 127, 147)');
    expect(snapToAccent('rgb(255, 255, 255)', 'latte')).toBe('rgb(124, 127, 147)');
});

//
// flavorBase
//

test('flavorBase - returns the flavor base as rgb()', () => {
    expect(flavorBase('mocha')).toBe('rgb(30, 30, 46)');
    expect(flavorBase('nope')).toBeNull();
});
