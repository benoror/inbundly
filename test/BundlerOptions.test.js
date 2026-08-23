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
