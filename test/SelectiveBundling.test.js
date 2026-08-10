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

import SelectiveBundling from '../src/bundling/SelectiveBundling';
import DomUtils from '../src/util/DomUtils';
import { customBundleKey } from '../src/util/CustomBundleKey';

/**
 * Build a SelectiveBundling with the given stored options. The chrome storage
 * callback fires synchronously here, so the instance is fully configured once
 * the constructor returns. combineLabels defaults to false so findRelevantLabels
 * returns the plain list of bundled labels rather than a single combined key.
 */
function makeBundling(stored, customBundles = null) {
    global.chrome = {
        storage: { sync: { get: (keys, cb) => cb({ combineLabels: false, ...stored }) } },
    };
    return new SelectiveBundling(customBundles);
}

function relevantLabels(bundling, messageLabels) {
    DomUtils.getLabelStrings = jest.fn().mockReturnValue(messageLabels);
    return bundling.findRelevantLabels({});
}

test('exclude list - "/*" wildcard excludes a label and its whole subtree', () => {
    const bundling = makeBundling({ exclude: true, labels: ['Newsletters/*'] });
    expect(relevantLabels(bundling, ['Newsletters', 'Newsletters/Tech', 'Newsletters/Tech/AI', 'Work']))
        .toEqual(['Work']);
});

test('include list - "/*" wildcard includes a label and its whole subtree', () => {
    const bundling = makeBundling({ exclude: false, labels: ['Newsletters/*'] });
    expect(relevantLabels(bundling, ['Newsletters/Tech', 'Newsletters/Tech/AI', 'Work']))
        .toEqual(['Newsletters/Tech', 'Newsletters/Tech/AI']);
});

test('wildcard matching is case-insensitive', () => {
    const bundling = makeBundling({ exclude: true, labels: ['newsletters/*'] });
    expect(relevantLabels(bundling, ['Newsletters/Tech', 'Work'])).toEqual(['Work']);
});

test('a plain (non-wildcard) entry still matches exactly, not the subtree', () => {
    const bundling = makeBundling({ exclude: true, labels: ['Newsletters'] });
    expect(relevantLabels(bundling, ['Newsletters', 'Newsletters/Tech']))
        .toEqual(['Newsletters/Tech']);
});

test('wildcard does not match a sibling sharing a prefix', () => {
    const bundling = makeBundling({ exclude: true, labels: ['News/*'] });
    expect(relevantLabels(bundling, ['Newsletters'])).toEqual(['Newsletters']);
});

test('blank list bundles everything when excluding', () => {
    const bundling = makeBundling({ exclude: true, labels: [] });
    expect(relevantLabels(bundling, ['Work', 'Newsletters/Tech']))
        .toEqual(['Work', 'Newsletters/Tech']);
});

//
// Custom bundles override label-based grouping
//

/**
 * A stand-in CustomBundles that reports the given thread as belonging to a
 * custom bundle. getThreadId is stubbed to that thread id.
 */
function withCustomBundle(threadId, bundleName) {
    DomUtils.getThreadId = jest.fn().mockReturnValue(threadId);
    return {
        keyForThread: id => id === threadId ? customBundleKey(bundleName) : null,
    };
}

test('a custom-bundled message uses its custom key, ignoring its labels', () => {
    const customBundles = withCustomBundle('t1', 'Trip');
    const bundling = makeBundling({ exclude: true, labels: [] }, customBundles);
    expect(relevantLabels(bundling, ['Work', 'Newsletters']))
        .toEqual([customBundleKey('Trip')]);
});

test('custom bundle wins over a matching priority rule', () => {
    const customBundles = withCustomBundle('t1', 'Trip');
    const bundling = makeBundling(
        { exclude: true, labels: [], priorityBundles: ['Work'] },
        customBundles);
    expect(relevantLabels(bundling, ['Work'])).toEqual([customBundleKey('Trip')]);
});

test('a message not in any custom bundle falls through to label grouping', () => {
    DomUtils.getThreadId = jest.fn().mockReturnValue('other');
    const customBundles = { keyForThread: () => null };
    const bundling = makeBundling({ exclude: true, labels: [] }, customBundles);
    expect(relevantLabels(bundling, ['Work'])).toEqual(['Work']);
});

//
// applyOptions — live updates from chrome.storage.sync (incl. other devices)
//

test('applyOptions updates include/exclude rules without reconstructing', () => {
    const bundling = makeBundling({ exclude: true, labels: [] });
    expect(relevantLabels(bundling, ['Work', 'News'])).toEqual(['Work', 'News']);

    bundling.applyOptions({ exclude: false, labels: ['Work'] });
    expect(relevantLabels(bundling, ['Work', 'News'])).toEqual(['Work']);
});

test('applyOptions leaves omitted keys alone', () => {
    const bundling = makeBundling({ exclude: false, labels: ['Work'], combineLabels: false });
    bundling.applyOptions({ labels: ['News'] });
    expect(bundling.exclude).toBe(false);
    expect(relevantLabels(bundling, ['Work', 'News'])).toEqual(['News']);
});

test('priority rule IH/Kamek.ai wins over other labels on the thread', () => {
    const bundling = makeBundling({
        exclude: true,
        labels: [],
        combineLabels: true,
        priorityBundles: [
            'Crypto',
            'Crypto/*',
            'IH/Kamek.ai',
            'IH/AI 🤖',
            'BrokerLit',
        ],
    });

    expect(relevantLabels(bundling, [
        'Inbox',
        'IH/Kamek.ai',
        'IH/Kamek.ai/@ben',
        'IH/Spoînt',
        'IH/Spoînt/BrokerLit',
        'Procevi',
    ])).toEqual(['IH/Kamek.ai']);
});

test('plain BrokerLit priority does not match a nested BrokerLit label', () => {
    const bundling = makeBundling({
        exclude: true,
        labels: [],
        combineLabels: true,
        priorityBundles: ['BrokerLit'],
    });

    expect(relevantLabels(bundling, ['IH/Spoînt/BrokerLit', 'Procevi']))
        .toEqual(['IH/Spoînt/BrokerLit\u001fProcevi']);
});
