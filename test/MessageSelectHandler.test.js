// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import MessageSelectHandler from '../src/handlers/MessageSelectHandler';
import { PINNED_STAMP_ATTR } from '../src/util/Constants';

// role="main" with one bundled section holding a Work row. Gmail's star is
// flipped the way the live list does it: names in place, no class change.
function setUp({ pinned = '0' } = {}) {
    window.history.replaceState(null, '', '/mail/u/0/#inbox');
    document.body.innerHTML = `
        <div role="main"><div class="ae4"><div class="Cp"><table class="F"><tbody data-inbundly-section="0">
            <tr class="zA yO" id="r1" ${PINNED_STAMP_ATTR}="${pinned}">
                <td class="apU xY"><span class="aXw T-KT" role="button"
                    aria-label="Not starred" data-tooltip="Not starred"><img class="T-KT-JX" alt="Not starred"></span></td>
                <td class="yX">sender</td>
            </tr>
        </tbody></table></div></div></div>`;
    const bundledMail = {
        getOpenedBundleRef: () => null,
        getBundleInSection: () => ({}),
    };
    const selectiveBundling = { findRelevantLabels: () => ['Work'] };
    const handler = new MessageSelectHandler(bundledMail, selectiveBundling);
    handler.inbundlyStyler = {
        markSelectedBundlesFor: () => {},
        disableBulkArchiveIfNecessary: () => {},
    };
    return { handler, row: document.getElementById('r1') };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('a star flipped by its names alone (no class change) is reported', async () => {
    const { handler, row } = setUp();
    const onStarToggle = jest.fn();
    handler.onStarToggle = onStarToggle;
    handler.startWatching();

    const star = row.querySelector('.T-KT');
    star.setAttribute('aria-label', 'Starred');
    await flush();

    expect(onStarToggle).toHaveBeenCalledTimes(1);
    handler.stopWatching();
});

test('attribute changes outside the star cell are not star flips', async () => {
    const { handler, row } = setUp();
    const onStarToggle = jest.fn();
    handler.onStarToggle = onStarToggle;
    handler.startWatching();

    row.querySelector('td.yX').setAttribute('title', 'Someone');
    await flush();

    expect(onStarToggle).not.toHaveBeenCalled();
    handler.stopWatching();
});

test('selecting a row kept out for its star does not hide it back in its bundle', async () => {
    const { handler, row } = setUp({ pinned: '1' });
    handler.startWatching();

    row.classList.add('x7');
    await flush();

    expect(row.classList.contains('bundled-message')).toBe(false);
    handler.stopWatching();
});

test('selecting a bundled row of a closed bundle keeps it hidden', async () => {
    const { handler, row } = setUp({ pinned: '0' });
    handler.startWatching();

    row.classList.add('x7');
    await flush();

    expect(row.classList.contains('bundled-message')).toBe(true);
    handler.stopWatching();
});
