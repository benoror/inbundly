// inboxy: Chrome extension for Google Inbox-style bundles in Gmail.
// Copyright (C) 2020  Teresa Ou

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
