// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import Bundler from '../src/bundling/Bundler';
import { Element, GmailClasses } from '../src/util/Constants';

function createBundler(keepStarredUnbundled) {
    const bundler = Object.create(Bundler.prototype);
    bundler.keepStarredUnbundled = keepStarredUnbundled;
    bundler.selectiveBundling = {
        findRelevantLabels: () => ['Newsletters'],
    };
    return bundler;
}

function createStarredMessage() {
    const message = document.createElement('div');
    message.innerHTML = `<span class="${GmailClasses.STARRED}"></span>`;
    return message;
}

test('starred messages stay outside bundles by default', () => {
    const bundler = createBundler(true);
    const message = createStarredMessage();

    expect(bundler._groupByLabel([message])).toEqual({});
});

test('starred messages can be included in bundles', () => {
    const bundler = createBundler(false);
    const message = createStarredMessage();
    const bundles = bundler._groupByLabel([message]);

    expect(bundles.Newsletters.getMessages()).toEqual([message]);
    expect(bundler._calculateMessageAndBundleRows([message], bundles)[0].type)
        .toBe(Element.BUNDLE);
});

test('starred messages render unbundled when the option is enabled', () => {
    const bundler = createBundler(false);
    const message = createStarredMessage();
    const bundles = bundler._groupByLabel([message]);

    bundler.applyOptions({ keepStarredUnbundled: true });

    expect(bundler._calculateMessageAndBundleRows([message], bundles)[0].type)
        .toBe(Element.UNBUNDLED_MESSAGE);
});

test('optionsReady resolves only after stored keepStarredUnbundled is applied', async () => {
    let deliver;
    global.chrome = {
        storage: {
            sync: {
                get(_defaults, cb) {
                    deliver = () => cb({ keepStarredUnbundled: false });
                },
            },
        },
    };

    const bundler = new Bundler({}, {}, {}, { findRelevantLabels: () => [] });
    expect(bundler.keepStarredUnbundled).toBe(true);

    const ready = bundler.optionsReady;
    deliver();
    await ready;

    expect(bundler.keepStarredUnbundled).toBe(false);
});

function singleMessageBundle() {
    return { getMessages: () => [document.createElement('div')] };
}

function prunableBundler(openedBundleRef) {
    const bundler = Object.create(Bundler.prototype);
    bundler.bundledMail = { getOpenedBundleRef: () => openedBundleRef };
    return bundler;
}

test('single-item bundles are pruned when not the reopened open bundle', () => {
    const bundler = prunableBundler({ sectionId: '0', label: 'Receipts', frozenOrder: 100 });
    const bundles = { Newsletters: singleMessageBundle() };

    bundler._pruneSingleItemBundles(bundles, '0', true);

    expect(bundles.Newsletters).toBeUndefined();
});

test('the reopened open bundle survives single-item pruning', () => {
    const bundler = prunableBundler({ sectionId: '0', label: 'Receipts', frozenOrder: 100 });
    const bundles = { Receipts: singleMessageBundle() };

    bundler._pruneSingleItemBundles(bundles, '0', true);

    expect(bundles.Receipts).toBeDefined();
});

test('the open-bundle exemption is scoped to its own section', () => {
    const bundler = prunableBundler({ sectionId: '1', label: 'Receipts', frozenOrder: 100 });
    const bundles = { Receipts: singleMessageBundle() };

    // Same label, different section — still pruned.
    bundler._pruneSingleItemBundles(bundles, '0', true);

    expect(bundles.Receipts).toBeUndefined();
});

test('single-item pruning ignores the open bundle when not reopening', () => {
    const bundler = prunableBundler({ sectionId: '0', label: 'Receipts', frozenOrder: 100 });
    const bundles = { Receipts: singleMessageBundle() };

    bundler._pruneSingleItemBundles(bundles, '0', false);

    expect(bundles.Receipts).toBeUndefined();
});

//
// Stale-section detection (rows Gmail streams into an already-bundled table)
//

function createBundledList() {
    const list = document.createElement('div');
    list.innerHTML = `
        <table class="F"><tbody>
            <tr class="zA" style="order: 100"></tr>
            <tr class="zA bundled-message"></tr>
            <tr class="zA bundle-row" style="order: 200"></tr>
            <div class="date-row" style="order: 50"></div>
            <div class="bundle-area"></div>
        </tbody></table>
    `;
    return list;
}

test('a fully processed section has no unprocessed rows', () => {
    const bundler = createBundler(true);

    expect(bundler._hasUnprocessedRows(createBundledList())).toBe(false);
});

test('a row streamed in without inbundly stamps marks the section stale', () => {
    const bundler = createBundler(true);
    const list = createBundledList();
    const streamed = document.createElement('tr');
    streamed.className = 'zA';
    list.querySelector('tbody').appendChild(streamed);

    expect(bundler._hasUnprocessedRows(list)).toBe(true);
});

test('removing injected nodes leaves only Gmail message rows', () => {
    const bundler = createBundler(true);
    const list = createBundledList();

    bundler._removeInjectedNodes(list);

    expect(list.querySelectorAll('.bundle-row, .date-row, .bundle-area').length).toBe(0);
    expect(list.querySelectorAll('tr.zA').length).toBe(2);
});
