// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Bundler's "starred sample" console line is a debug aid: it follows the one
// DEBUG flag in src/util/Debug.js instead of logging unconditionally.

import Bundler from '../src/bundling/Bundler';
import { GmailClasses } from '../src/util/Constants';

let mockDebug = false;
jest.mock('../src/util/Debug', () => ({
    __esModule: true,
    isDebugEnabled: () => mockDebug,
    logDebugMessage: message => {
        if (mockDebug) {
            console.log(`inbundly-debug: ${message}`);
        }
    },
}));

function createBundler() {
    const bundler = Object.create(Bundler.prototype);
    bundler.keepStarredUnbundled = true;
    bundler.skipSingleItemBundles = true;
    bundler.selectiveBundling = { findRelevantLabels: () => ['Work'] };
    return bundler;
}

function starredRow() {
    const row = document.createElement('tr');
    row.className = 'zA';
    row.innerHTML = `<td><span class="${GmailClasses.STARRED}"></span></td>`;
    return row;
}

let log;
beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
    log.mockRestore();
});

test('the starred sample stays silent with DEBUG off, and is not even computed', () => {
    mockDebug = false;
    const bundler = createBundler();
    const isStarred = jest.spyOn(bundler, '_isStarred');

    bundler._logStarredSample([starredRow(), starredRow()]);

    expect(log).not.toHaveBeenCalled();
    expect(isStarred).not.toHaveBeenCalled();
});

test('the starred sample logs through the debug channel with DEBUG on', () => {
    mockDebug = true;
    const bundler = createBundler();

    bundler._logStarredSample([starredRow()]);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^inbundly-debug: starred sample \[\{"keepStarredUnbundled":true/);
});

test('Bundler has no unconditional console.log left', () => {
    const source = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'src', 'bundling', 'Bundler.js'), 'utf8');
    expect(source).not.toMatch(/console\.log/);
});
