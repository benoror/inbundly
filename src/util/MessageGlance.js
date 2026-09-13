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

import { GmailClasses, Selectors } from './Constants';

const text = node => (node && node.textContent || '').replace(/\s+/g, ' ').trim();

/**
 * What a collapsed bundle row can tell about its newest thread without being
 * opened: who wrote last, and when.
 *
 * `messages` are the bundle's rows in Gmail's list order, newest first, so the
 * first row is the latest thread. Gmail lists a thread's participants oldest
 * first, so its last `span[email]` is the most recent sender.
 *
 * Returns null for an empty bundle; otherwise:
 *   sender     { name, email } of the latest thread's most recent sender, or
 *              null when the row exposes none (drafts).
 *   date       the date text Gmail shows for that thread, or its snoozed-until
 *              text when it is snoozed.
 *   dateTitle  Gmail's full-date tooltip for it, or null.
 *   isUnread   the latest thread is unread.
 *   isSnoozed  the latest thread is snoozed.
 */
function latestMessageGlance(messages) {
    if (!messages || !messages.length) {
        return null;
    }
    const latest = messages[0];

    const senderSpans = latest.querySelectorAll(Selectors.SENDERS);
    const senderSpan = senderSpans.length ? senderSpans[senderSpans.length - 1] : null;
    const email = senderSpan ? (senderSpan.getAttribute('email') || '') : '';
    const name = senderSpan
        ? (text(senderSpan) || senderSpan.getAttribute('name') || email)
        : '';
    const sender = name ? { name, email } : null;

    const snoozedText = latest.querySelector(Selectors.MESSAGE_SNOOZED_TEXT);
    const dateNode = latest.querySelector(Selectors.MESSAGE_DATE);
    const dateSpan = latest.querySelector(Selectors.MESSAGE_DATE_SPAN);

    return {
        sender,
        date: snoozedText ? text(snoozedText) : text(dateSpan || dateNode),
        dateTitle: dateNode && dateNode.getAttribute('title') || null,
        isUnread: latest.classList.contains(GmailClasses.UNREAD),
        isSnoozed: !!snoozedText,
    };
}

export { latestMessageGlance };
