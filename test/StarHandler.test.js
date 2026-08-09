// inboxy: Chrome extension for Google Inbox-style bundles in Gmail.
// Copyright (C) 2020  Teresa Ou

import StarHandler from '../src/handlers/StarHandler';

function createHandler(keepStarredUnbundled) {
    const handler = Object.create(StarHandler.prototype);
    handler.keepStarredUnbundled = keepStarredUnbundled;
    handler.prevTop = null;
    handler.bundledMail = {
        getLabelOfOpenedBundle: () => {
            throw new Error('scroll state should not be inspected');
        },
    };
    handler.selectiveBundling = {
        findRelevantLabels: () => {
            throw new Error('labels should not be inspected');
        },
    };
    return handler;
}

test('star clicks need no scroll compensation when starred messages stay bundled', () => {
    const handler = createHandler(false);
    const star = document.createElement('div');
    star.className = 'T-KT aXw';

    expect(() => handler.handleStarring({ target: star })).not.toThrow();
    expect(handler.prevTop).toBeNull();
});

test('disabling starred unbundling clears pending scroll compensation', () => {
    const handler = createHandler(true);
    handler.prevTop = 100;

    handler.applyOptions({ keepStarredUnbundled: false });

    expect(handler.keepStarredUnbundled).toBe(false);
    expect(handler.prevTop).toBeNull();
});
