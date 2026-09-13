// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import OpenBundleStore from '../src/util/OpenBundleStore';

// The store keys its record by view/page/tab; make those controllable per test.
let mockView = 'inbox';
let mockPage = 1;
let mockTab = '__NO_TAB';
jest.mock('../src/util/MessagePageUtils', () => ({
    getCurrentViewKey: () => mockView,
    getCurrentPageNumber: () => mockPage,
    getCurrentTab: () => mockTab,
}));

beforeEach(() => {
    mockView = 'inbox';
    mockPage = 1;
    mockTab = '__NO_TAB';
    window.sessionStorage.clear();
});

test('a bundle remembered in another list view does not leak', () => {
    OpenBundleStore.save('0', 'Work');

    mockView = 'search/label%3AInbox+label%3AWork';
    expect(OpenBundleStore.load()).toBeNull();

    OpenBundleStore.save('0', 'acme.com');
    expect(OpenBundleStore.load()).toEqual({ sectionId: '0', label: 'acme.com' });

    mockView = 'inbox';
    // One record: the search's save replaced the inbox one.
    expect(OpenBundleStore.load()).toBeNull();
});

test('a record from before views were tracked is ignored', () => {
    window.sessionStorage.setItem('inbundly:openBundle:v1', JSON.stringify({
        page: 1, tab: '__NO_TAB', sectionId: '0', label: 'Work',
    }));

    expect(OpenBundleStore.load()).toBeNull();
});

test('save and load round-trip on the same page and tab', () => {
    OpenBundleStore.save('0', 'Receipts');

    expect(OpenBundleStore.load()).toEqual({ sectionId: '0', label: 'Receipts' });
});

test('load returns null with nothing saved', () => {
    expect(OpenBundleStore.load()).toBeNull();
});

test('a bundle remembered on another page or tab does not leak', () => {
    OpenBundleStore.save('0', 'Receipts');

    mockPage = 2;
    expect(OpenBundleStore.load()).toBeNull();

    mockPage = 1;
    mockTab = 'Promotions';
    expect(OpenBundleStore.load()).toBeNull();

    mockTab = '__NO_TAB';
    expect(OpenBundleStore.load()).toEqual({ sectionId: '0', label: 'Receipts' });
});

test('clear forgets the remembered bundle', () => {
    OpenBundleStore.save('0', 'Receipts');
    OpenBundleStore.clear();

    expect(OpenBundleStore.load()).toBeNull();
});

test('a corrupt stored value reads as nothing saved', () => {
    window.sessionStorage.setItem('inbundly:openBundle:v1', '{not json');
    expect(OpenBundleStore.load()).toBeNull();

    window.sessionStorage.setItem('inbundly:openBundle:v1', JSON.stringify({ page: 1 }));
    expect(OpenBundleStore.load()).toBeNull();
});

test('sessionStorage failures are swallowed', () => {
    const throwing = {
        getItem: () => { throw new Error('storage disabled'); },
        setItem: () => { throw new Error('storage disabled'); },
        removeItem: () => { throw new Error('storage disabled'); },
    };
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', { value: throwing, configurable: true });

    try {
        expect(() => OpenBundleStore.save('0', 'Receipts')).not.toThrow();
        expect(OpenBundleStore.load()).toBeNull();
        expect(() => OpenBundleStore.clear()).not.toThrow();
    }
    finally {
        Object.defineProperty(window, 'sessionStorage', original);
    }
});
