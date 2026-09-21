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

import { latestMessageGlance } from '../src/util/MessageGlance';

/**
 * A Gmail-shaped message row: participants in `.yW .bA4` (oldest first, as
 * Gmail lists them), the date in `.xW`, and optionally Gmail's snoozed-until
 * text in `.byZ .cL`.
 */
function messageRow({
    senders = [{ name: 'Jane Doe', email: 'jane@acme.com' }],
    date = '10:00 AM',
    dateTitle = 'Wed, Sep 9, 2026, 10:00 AM',
    unread = false,
    snoozedText = null,
} = {}) {
    const row = document.createElement('tr');
    row.className = `zA ${unread ? 'zE' : 'yO'}`;
    const senderSpans = senders.map(s => {
        const emailAttr = s.email === undefined ? '' : ` email="${s.email}"`;
        const nameAttr = s.nameAttr ? ` name="${s.nameAttr}"` : '';
        return `<span${emailAttr}${nameAttr}>${s.name}</span>`;
    }).join('');
    row.innerHTML = `
        <td class="yX xY"><div class="yW"><span class="bA4">${senderSpans}</span></div></td>
        <td class="xY a4W"><div class="y6"><span><span>Subject</span></span></div></td>
        <td class="byZ xY">${snoozedText ? `<span class="cL">${snoozedText}</span>` : ''}</td>
        <td class="xW xY"><span title="${dateTitle}"><span>${date}</span></span></td>
    `;
    return row;
}

test('reads the latest thread\'s most recent sender and date', () => {
    const glance = latestMessageGlance([
        messageRow({
            senders: [
                { name: 'Old Participant', email: 'old@acme.com' },
                { name: 'Jane Doe', email: 'jane@acme.com' },
            ],
        }),
        messageRow({ senders: [{ name: 'Bob', email: 'bob@acme.com' }], date: 'Sep 3' }),
    ]);

    expect(glance).toEqual({
        sender: { name: 'Jane Doe', email: 'jane@acme.com' },
        date: '10:00 AM',
        dateTitle: 'Wed, Sep 9, 2026, 10:00 AM',
        isUnread: false,
        isSnoozed: false,
    });
});

test('an unread latest thread is reported unread', () => {
    const glance = latestMessageGlance([messageRow({ unread: true }), messageRow()]);
    expect(glance.isUnread).toBe(true);
});

test('a snoozed latest thread shows its snoozed-until text as the date', () => {
    const glance = latestMessageGlance([messageRow({ snoozedText: 'Tomorrow, 8:00 AM' })]);
    expect(glance.date).toBe('Tomorrow, 8:00 AM');
    expect(glance.isSnoozed).toBe(true);
});

test('a row without any sender span (drafts) yields no sender, still a date', () => {
    const row = messageRow();
    row.querySelector('.bA4').innerHTML = '';
    const glance = latestMessageGlance([row]);
    expect(glance.sender).toBeNull();
    expect(glance.date).toBe('10:00 AM');
});

test('falls back to the name attribute, then the address, when the span text is empty', () => {
    const byName = latestMessageGlance([messageRow({
        senders: [{ name: '', nameAttr: 'Jane Doe', email: 'jane@acme.com' }],
    })]);
    expect(byName.sender).toEqual({ name: 'Jane Doe', email: 'jane@acme.com' });

    const byEmail = latestMessageGlance([messageRow({
        senders: [{ name: '', email: 'jane@acme.com' }],
    })]);
    expect(byEmail.sender).toEqual({ name: 'jane@acme.com', email: 'jane@acme.com' });
});

test('whitespace around Gmail\'s text is collapsed', () => {
    const glance = latestMessageGlance([messageRow({
        senders: [{ name: '\n  Jane   Doe\n', email: 'jane@acme.com' }],
        date: '\n 10:00 AM \n',
    })]);
    expect(glance.sender.name).toBe('Jane Doe');
    expect(glance.date).toBe('10:00 AM');
});

test('a row without a date cell yields an empty date and no tooltip', () => {
    const row = messageRow();
    row.querySelector('.xW').remove();
    const glance = latestMessageGlance([row]);
    expect(glance.date).toBe('');
    expect(glance.dateTitle).toBeNull();
});

test('an empty bundle has no glance', () => {
    expect(latestMessageGlance([])).toBeNull();
    expect(latestMessageGlance(undefined)).toBeNull();
});
