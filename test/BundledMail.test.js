// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import BundledMail from '../src/containers/BundledMail';
import Bundle from '../src/containers/Bundle';

// BundledMail keys bundles by page/tab; pin those to fixed values so the tests
// exercise only the section/label dimension.
jest.mock('../src/util/MessagePageUtils', () => ({
    getCurrentPageNumber: () => 1,
    getCurrentTab: () => '__NO_TAB',
}));

function bundle(label, sectionId) {
    return new Bundle(label, sectionId);
}

test('the same label bundles independently in different sections', () => {
    const bundledMail = new BundledMail();
    const s0 = bundle('Receipts', '0');
    const s1 = bundle('Receipts', '1');

    bundledMail.setBundles({ Receipts: s0 }, 1, '0');
    bundledMail.setBundles({ Receipts: s1 }, 1, '1');

    expect(bundledMail.getBundleInSection('0', 'Receipts')).toBe(s0);
    expect(bundledMail.getBundleInSection('1', 'Receipts')).toBe(s1);
    expect(bundledMail.findBundlesByLabel('Receipts')).toEqual([s0, s1]);
    expect(bundledMail.getAllBundles()).toEqual([s0, s1]);
});

test('the open bundle is identified by section and label', () => {
    const bundledMail = new BundledMail();
    const s0 = bundle('Receipts', '0');
    const s1 = bundle('Receipts', '1');
    bundledMail.setBundles({ Receipts: s0 }, 1, '0');
    bundledMail.setBundles({ Receipts: s1 }, 1, '1');

    bundledMail.openBundle('1', 'Receipts');

    expect(bundledMail.getOpenedBundleRef()).toEqual({ sectionId: '1', label: 'Receipts' });
    expect(bundledMail.getOpenedBundle()).toBe(s1);

    bundledMail.closeBundle();
    expect(bundledMail.getOpenedBundleRef()).toBeNull();
    expect(bundledMail.getOpenedBundle()).toBeNull();
});

test('getOpenedBundle resolves against the latest bundles after a rebundle', () => {
    const bundledMail = new BundledMail();
    bundledMail.setBundles({ Receipts: bundle('Receipts', '0') }, 1, '0');
    bundledMail.openBundle('0', 'Receipts');

    // Rebundle replaces the section's bundles with a fresh instance.
    const rebuilt = bundle('Receipts', '0');
    bundledMail.setBundles({ Receipts: rebuilt }, 1, '0');

    expect(bundledMail.getOpenedBundle()).toBe(rebuilt);
});

test('pruneSectionsFrom drops out-of-range sections but keeps the rest', () => {
    const bundledMail = new BundledMail();
    bundledMail.setBundles({ A: bundle('A', '0') }, 1, '0');
    bundledMail.setBundles({ B: bundle('B', '1') }, 1, '1');
    bundledMail.setBundles({ C: bundle('C', '2') }, 1, '2');

    // Layout shrank from 3 sections to 2.
    bundledMail.pruneSectionsFrom(2);

    expect(bundledMail.getAllBundles().map(b => b.getLabel())).toEqual(['A', 'B']);
});

test('no open bundle and unknown lookups are safe before any bundling', () => {
    const bundledMail = new BundledMail();
    expect(bundledMail.getOpenedBundle()).toBeNull();
    expect(bundledMail.getAllBundles()).toEqual([]);
    expect(bundledMail.findBundlesByLabel('Nope')).toEqual([]);
    expect(bundledMail.getBundleInSection('0', 'Nope')).toBeUndefined();
});
