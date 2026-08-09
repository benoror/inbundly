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

import {
    OPTION_DEFAULTS,
    OPTION_KEYS,
    BUNDLING_OPTION_KEYS,
    UI_OPTION_KEYS,
    changesInclude,
    optionsFromChanges,
} from '../src/util/Options';

test('OPTION_KEYS covers every default', () => {
    expect(OPTION_KEYS.sort()).toEqual(Object.keys(OPTION_DEFAULTS).sort());
    expect(OPTION_DEFAULTS.keepStarredUnbundled).toBe(true);
});

test('bundling and UI key groups partition the option keys', () => {
    const combined = [...BUNDLING_OPTION_KEYS, ...UI_OPTION_KEYS].sort();
    expect(combined).toEqual([...OPTION_KEYS].sort());
});

test('changesInclude detects overlapping keys', () => {
    expect(changesInclude({ labels: { newValue: ['A'] } }, BUNDLING_OPTION_KEYS)).toBe(true);
    expect(changesInclude({ showPinnedToggle: { newValue: true } }, BUNDLING_OPTION_KEYS)).toBe(false);
    expect(changesInclude({ showPinnedToggle: { newValue: true } }, UI_OPTION_KEYS)).toBe(true);
});

test('optionsFromChanges uses newValue and falls back to defaults when removed', () => {
    expect(optionsFromChanges(
        {
            exclude: { oldValue: true, newValue: false },
            labels: { oldValue: ['A'], newValue: undefined },
        },
        ['exclude', 'labels', 'combineLabels'],
    )).toEqual({
        exclude: false,
        labels: OPTION_DEFAULTS.labels,
    });
});
