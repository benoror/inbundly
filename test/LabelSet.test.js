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
    formatLabelSetTitle,
    matchLabelPattern,
    parsePriorityRules,
    ruleMatchesLabels,
    ruleLabels,
} from '../src/util/LabelSet';

test('formatLabelSetTitle - single label is unchanged', () => {
    expect(formatLabelSetTitle(['IH/Kamek'])).toBe('IH/Kamek');
});

test('formatLabelSetTitle - no shared parent joins with " + "', () => {
    expect(formatLabelSetTitle(['Crypto', 'Fin'])).toBe('Crypto + Fin');
    expect(formatLabelSetTitle(['Fam/+ale', 'Trav'])).toBe('Fam/+ale + Trav');
});

test('formatLabelSetTitle - parent label plus its child shows parent once', () => {
    expect(formatLabelSetTitle(['IH/AI', 'IH/AI/Bender'])).toBe('IH/AI + Bender');
});

test('formatLabelSetTitle - parent with several children', () => {
    expect(formatLabelSetTitle(['IH/AI', 'IH/AI/Bender', 'IH/AI/Cortana']))
        .toBe('IH/AI + Bender + Cortana');
});

test('formatLabelSetTitle - siblings group leaves under the shared parent', () => {
    expect(formatLabelSetTitle(['IH/AI', 'IH/Kamek', 'IH/Spoint/Bro']))
        .toBe('IH/(AI, Kamek, Spoint/Bro)');
});

test('formatLabelSetTitle - factors multiple shared segments', () => {
    expect(formatLabelSetTitle(['A/B/x', 'A/B/y'])).toBe('A/B/(x, y)');
});

test('formatLabelSetTitle - partial segment overlap is not treated as shared', () => {
    // "AI" and "AInautics" are different segments, so no common parent
    expect(formatLabelSetTitle(['IH/AI', 'IH/AInautics']))
        .toBe('IH/(AI, AInautics)');
});

test('formatLabelSetTitle - factors a parent shared by only a subset', () => {
    expect(formatLabelSetTitle(['Fam/+ale', 'Fam/Contab', 'Fin', 'Job/Trivelta', 'USA']))
        .toBe('Fam/(+ale, Contab) + Fin + Job/Trivelta + USA');
});

test('formatLabelSetTitle - factors several independent parent groups', () => {
    expect(formatLabelSetTitle(['A/x', 'A/y', 'B/z'])).toBe('A/(x, y) + B/z');
});

//
// matchLabelPattern
//

test('matchLabelPattern - exact match, case-insensitive', () => {
    expect(matchLabelPattern('Crypto', 'Crypto')).toBe(true);
    expect(matchLabelPattern('crypto', 'Crypto')).toBe(true);
    expect(matchLabelPattern('Crypto', 'Taxes')).toBe(false);
});

test('matchLabelPattern - exact pattern does not match sub-labels', () => {
    expect(matchLabelPattern('Crypto', 'Crypto/Trading')).toBe(false);
});

test('matchLabelPattern - wildcard matches the base label and its subtree', () => {
    expect(matchLabelPattern('Crypto/*', 'Crypto')).toBe(true);
    expect(matchLabelPattern('Crypto/*', 'Crypto/Trading')).toBe(true);
    expect(matchLabelPattern('Crypto/*', 'Crypto/Trading/BTC')).toBe(true);
});

test('matchLabelPattern - wildcard does not match a sibling with a shared prefix', () => {
    expect(matchLabelPattern('Crypto/*', 'Cryptography')).toBe(false);
});

test('matchLabelPattern - wildcard is multi-level and parent-inclusive', () => {
    expect(matchLabelPattern('Newsletters/*', 'Newsletters')).toBe(true);
    expect(matchLabelPattern('Newsletters/*', 'Newsletters/Tech/AI/Weekly')).toBe(true);
    expect(matchLabelPattern('newsletters/*', 'Newsletters/Tech')).toBe(true);
    expect(matchLabelPattern('Newsletters/*', 'Work')).toBe(false);
});

//
// parsePriorityRules
//

test('parsePriorityRules - single-label rules', () => {
    expect(parsePriorityRules(['Crypto', 'Contabilidad']))
        .toEqual([['Crypto'], ['Contabilidad']]);
});

test('parsePriorityRules - a "+" set rule splits and trims members', () => {
    expect(parsePriorityRules(['A + B', ' Crypto/* '])).toEqual([['A', 'B'], ['Crypto/*']]);
});

test('parsePriorityRules - blank lines and stray separators are dropped', () => {
    expect(parsePriorityRules(['', 'A + ', ' + '])).toEqual([['A']]);
});

//
// ruleMatchesLabels
//

test('ruleMatchesLabels - single-label rule matches regardless of other labels', () => {
    expect(ruleMatchesLabels(['Crypto'], ['Crypto', 'Taxes'])).toBe(true);
    expect(ruleMatchesLabels(['Crypto'], ['Taxes'])).toBe(false);
});

test('ruleMatchesLabels - set rule requires every member present', () => {
    expect(ruleMatchesLabels(['A', 'B'], ['A', 'B', 'D'])).toBe(true);
    expect(ruleMatchesLabels(['A', 'B'], ['A', 'D'])).toBe(false);
});

test('ruleMatchesLabels - wildcard member matches a nested label', () => {
    expect(ruleMatchesLabels(['Crypto/*'], ['Crypto/Trading'])).toBe(true);
});

//
// ruleLabels
//

test('ruleLabels - strips the wildcard suffix for display/identity', () => {
    expect(ruleLabels(['Crypto/*'])).toEqual(['Crypto']);
    expect(ruleLabels(['A', 'B'])).toEqual(['A', 'B']);
});
