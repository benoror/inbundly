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

import ArchiveAction from '../src/util/ArchiveAction';
import BulkArchiveButton from '../src/components/BulkArchiveButton';
import { OPTION_DEFAULTS } from '../src/util/Options';

/**
 * A minimal Gmail-like message row: checkbox toggling its own aria-checked
 * on click, a star that toggles between Gmail's starred / unstarred classes
 * on click, and the unread class when asked.
 */
function makeMessage({ starred = false, unread = false, checked = false, subject = '' } = {}) {
    const tr = document.createElement('tr');
    tr.className = `zA ${unread ? 'zE' : 'yO'}`;
    tr.dataset.subject = subject;

    const box = document.createElement('div');
    box.className = 'oZ-jc T-Jo J-J5-Ji';
    box.setAttribute('aria-checked', checked ? 'true' : 'false');
    box.addEventListener('click', () => {
        const next = box.getAttribute('aria-checked') === 'true' ? 'false' : 'true';
        box.setAttribute('aria-checked', next);
    });
    tr.appendChild(box);

    const star = document.createElement('span');
    star.className = starred ? 'T-KT T-KT-Jp' : 'T-KT aXw';
    star.addEventListener('click', () => {
        const isStarred = star.classList.contains('T-KT-Jp');
        star.className = isStarred ? 'T-KT aXw' : 'T-KT T-KT-Jp';
        starClicks.push(tr.dataset.subject);
    });
    tr.appendChild(star);
    return tr;
}

const isChecked = m => m.querySelector('.oZ-jc').getAttribute('aria-checked') === 'true';
const isStarred = m => !!m.querySelector('.T-KT-Jp');

let starClicks;
let toolbarClicks;

/**
 * Gmail's toolbar: the action cluster hidden until something is selected,
 * holding Archive (act=7) and, when `withMarkRead`, the envelope in its
 * "Mark as read" state. Clicks are logged; "Mark as read" also flips the
 * envelope to "Mark as unread", as Gmail does once the selection is read.
 */
function makeToolbar({ withMarkRead = true } = {}) {
    document.body.innerHTML = `
        <div class="G-atb">
            <div class="G-Ni" style="display: none;">
                <div class="T-I J-J5-Ji" act="7" aria-label="Archive" role="button"></div>
                ${withMarkRead ? `<div class="T-I J-J5-Ji" data-tooltip="Mark as read"
                    aria-label="Mark as read" role="button"></div>` : ''}
            </div>
        </div>
    `;
    document.querySelectorAll('.G-atb .T-I').forEach(button => {
        button.addEventListener('click', () => {
            const name = button.getAttribute('data-tooltip') || 'act:' + button.getAttribute('act');
            toolbarClicks.push(name);
            if (name === 'Mark as read') {
                button.setAttribute('data-tooltip', 'Mark as unread');
                button.setAttribute('aria-label', 'Mark as unread');
            }
        });
    });
}

function revealToolbar() {
    document.querySelector('.G-Ni').style.display = 'block';
}

// The archive click waits for the toolbar to reveal (a MutationObserver
// callback), then the preceded-by path defers the main click one more task.
async function settle() {
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
    starClicks = [];
    toolbarClicks = [];
    ArchiveAction.applyOptions({
        skipStarredOnArchive: OPTION_DEFAULTS.skipStarredOnArchive,
        markReadOnArchive: OPTION_DEFAULTS.markReadOnArchive,
        unstarOnArchive: OPTION_DEFAULTS.unstarOnArchive,
    });
    makeToolbar();
});

describe('defaults', () => {
    test('the switches start off and archive-all sweeps every thread, stars included', async () => {
        expect(ArchiveAction.getOptions()).toEqual({
            skipStarredOnArchive: false,
            markReadOnArchive: false,
            unstarOnArchive: false,
        });
        const messages = [
            makeMessage({ subject: 'plain', unread: true }),
            makeMessage({ subject: 'pinned', starred: true }),
        ];

        const targets = ArchiveAction.archive(messages);

        expect(targets).toEqual(messages);
        expect(messages.map(isChecked)).toEqual([true, true]);
        revealToolbar();
        await settle();
        expect(toolbarClicks).toEqual(['act:7']);
        expect(starClicks).toEqual([]);
        expect(isStarred(messages[1])).toBe(true);
    });

    test('applyOptions takes only the archive keys and coerces to booleans', () => {
        ArchiveAction.applyOptions({ skipStarredOnArchive: 1, labels: ['x'], unknown: true });
        expect(ArchiveAction.getOptions().skipStarredOnArchive).toBe(true);
        expect(ArchiveAction.getOptions()).not.toHaveProperty('labels');
    });

    test('loadOptions overlays the stored switches and resolves', async () => {
        global.chrome = {
            storage: {
                sync: {
                    get: (defaults, cb) => cb({ ...defaults, markReadOnArchive: true }),
                },
            },
        };
        try {
            await ArchiveAction.loadOptions();
            expect(ArchiveAction.getOptions()).toEqual({
                skipStarredOnArchive: false,
                markReadOnArchive: true,
                unstarOnArchive: false,
            });
        }
        finally {
            delete global.chrome;
        }
    });
});

describe('skipStarredOnArchive', () => {
    beforeEach(() => ArchiveAction.applyOptions({ skipStarredOnArchive: true }));

    test('starred threads are left out of the selection and stay put', async () => {
        const messages = [
            makeMessage({ subject: 'a' }),
            makeMessage({ subject: 'pinned', starred: true }),
            makeMessage({ subject: 'b' }),
        ];

        const targets = ArchiveAction.archive(messages);

        expect(targets.map(m => m.dataset.subject)).toEqual(['a', 'b']);
        expect(messages.map(isChecked)).toEqual([true, false, true]);
        revealToolbar();
        await settle();
        expect(toolbarClicks).toEqual(['act:7']);
    });

    test('a starred thread the user had checked by hand is deselected first', () => {
        const messages = [
            makeMessage({ subject: 'a' }),
            makeMessage({ subject: 'pinned', starred: true, checked: true }),
        ];

        ArchiveAction.archive(messages);

        expect(messages.map(isChecked)).toEqual([true, false]);
    });

    test('a section of nothing but starred threads is a no-op: Gmail is not touched', async () => {
        const messages = [
            makeMessage({ subject: 'pinned 1', starred: true }),
            makeMessage({ subject: 'pinned 2', starred: true }),
        ];

        expect(ArchiveAction.archive(messages)).toEqual([]);
        expect(ArchiveAction.archivable(messages)).toEqual([]);
        expect(messages.map(isChecked)).toEqual([false, false]);
        revealToolbar();
        await settle();
        expect(toolbarClicks).toEqual([]);
    });

    test('archivable is the whole list when the switch is off', () => {
        ArchiveAction.applyOptions({ skipStarredOnArchive: false });
        const messages = [makeMessage({ starred: true }), makeMessage()];
        expect(ArchiveAction.archivable(messages)).toEqual(messages);
    });
});

describe('markReadOnArchive', () => {
    beforeEach(() => ArchiveAction.applyOptions({ markReadOnArchive: true }));

    test('an unread selection is marked read through the toolbar, then archived', async () => {
        const messages = [makeMessage({ unread: true }), makeMessage()];

        ArchiveAction.archive(messages);
        revealToolbar();
        await settle();

        expect(toolbarClicks).toEqual(['Mark as read', 'act:7']);
    });

    test('an all-read selection skips straight to archive', async () => {
        const messages = [makeMessage(), makeMessage()];

        ArchiveAction.archive(messages);
        revealToolbar();
        await settle();

        expect(toolbarClicks).toEqual(['act:7']);
    });

    test('when Gmail shows no "Mark as read" button the archive still runs', async () => {
        makeToolbar({ withMarkRead: false });
        const messages = [makeMessage({ unread: true })];

        ArchiveAction.archive(messages);
        revealToolbar();
        await settle();

        expect(toolbarClicks).toEqual(['act:7']);
    });

    test('unread state is judged on the threads being archived, not the skipped ones', async () => {
        ArchiveAction.applyOptions({ skipStarredOnArchive: true });
        const messages = [
            makeMessage({ subject: 'pinned unread', starred: true, unread: true }),
            makeMessage({ subject: 'read' }),
        ];

        ArchiveAction.archive(messages);
        revealToolbar();
        await settle();

        expect(toolbarClicks).toEqual(['act:7']);
    });
});

describe('unstarOnArchive', () => {
    beforeEach(() => ArchiveAction.applyOptions({ unstarOnArchive: true }));

    test('stars come off the threads being archived before the toolbar click', async () => {
        const messages = [
            makeMessage({ subject: 'pinned', starred: true }),
            makeMessage({ subject: 'plain' }),
        ];

        ArchiveAction.archive(messages);

        expect(starClicks).toEqual(['pinned']);
        expect(isStarred(messages[0])).toBe(false);
        expect(messages.map(isChecked)).toEqual([true, true]);
        revealToolbar();
        await settle();
        expect(toolbarClicks).toEqual(['act:7']);
    });

    test('with skip-starred on too, skipped threads keep their star', () => {
        ArchiveAction.applyOptions({ skipStarredOnArchive: true });
        const messages = [
            makeMessage({ subject: 'pinned', starred: true }),
            makeMessage({ subject: 'plain' }),
        ];

        ArchiveAction.archive(messages);

        expect(starClicks).toEqual([]);
        expect(isStarred(messages[0])).toBe(true);
        expect(messages.map(isChecked)).toEqual([false, true]);
    });
});

describe('BulkArchiveButton', () => {
    test('the archive-all icon goes through the archive switches', async () => {
        ArchiveAction.applyOptions({ skipStarredOnArchive: true, markReadOnArchive: true });
        const messages = [
            makeMessage({ subject: 'unread', unread: true }),
            makeMessage({ subject: 'pinned', starred: true }),
        ];
        const button = BulkArchiveButton.create(messages);

        button.click();

        expect(messages.map(isChecked)).toEqual([true, false]);
        revealToolbar();
        await settle();
        expect(toolbarClicks).toEqual(['Mark as read', 'act:7']);
    });

    test('a disabled icon does nothing', () => {
        const messages = [makeMessage()];
        const button = BulkArchiveButton.create(messages);
        button.classList.add('disabled');

        button.click();

        expect(messages.map(isChecked)).toEqual([false]);
    });

    test('the click does not bubble to the row (no bundle toggle)', () => {
        const button = BulkArchiveButton.create([makeMessage()]);
        const row = document.createElement('tr');
        row.appendChild(button);
        const rowListener = jest.fn();
        row.addEventListener('click', rowListener);

        button.click();

        expect(rowListener).not.toHaveBeenCalled();
    });
});
