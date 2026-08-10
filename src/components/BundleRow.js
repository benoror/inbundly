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

import BulkArchiveButton from './BulkArchiveButton';

import MessagePageUtils from '../util/MessagePageUtils';
import DomUtils from '../util/DomUtils';
import { formatLabelSetTitle } from '../util/LabelSet';
import { isCustomBundleKey, customBundleName } from '../util/CustomBundleKey';
import {
    GmailClasses,
    InbundlyClasses,
    Selectors,
    LABEL_SET_SEPARATOR,
} from '../util/Constants';

const MAX_MESSAGE_COUNT = 25;

/**
 * Create a table row for a bundle, to be shown in the list of messages. 
 */
function create(label, order, messages, hasUnread, toggleBundle, baseUrl, labelColors) {
    const displayedMessageCount = messages.length >= MAX_MESSAGE_COUNT
        ? `${MAX_MESSAGE_COUNT}+`
        : messages.length;
    const unreadClass = hasUnread ? GmailClasses.UNREAD : GmailClasses.READ;

    // A custom bundle's key carries the user's chosen name; show it verbatim.
    // Otherwise a combined-label bundle's key is several labels joined; present
    // them compactly (factoring any shared parent path). Single-label keys split
    // to themselves (no separator present).
    const isCustom = isCustomBundleKey(label);
    const labels = label.split(LABEL_SET_SEPARATOR);
    const displayLabel = isCustom ? customBundleName(label) : formatLabelSetTitle(labels);

    let spacerClass = '';
    if (document.querySelector(Selectors.IMPORTANCE_MARKER)) {
        spacerClass = GmailClasses.IMPORTANCE_MARKER;
    }
    else if (document.querySelector(Selectors.PERSONAL_LEVEL_INDICATOR)) {
        spacerClass = GmailClasses.PERSONAL_LEVEL_INDICATOR;
    }

    const sendersText = _generateSendersText(messages).join(', ');

    const snoozedText = messages[0].querySelector(Selectors.MESSAGE_SNOOZED_TEXT);
    const latestDate = snoozedText
        ? snoozedText.innerText
        : messages[0].querySelector(Selectors.MESSAGE_DATE_SPAN).innerText;

    const latestIsUnreadClass = messages[0].classList.contains(GmailClasses.UNREAD) ? 'unread' : '';
    const latestIsSnoozedClass = snoozedText ? GmailClasses.SNOOZED : '';

    const html = `
        <tr class="${GmailClasses.ROW} ${InbundlyClasses.BUNDLE_ROW} ${unreadClass}">
            <td class="${GmailClasses.CELL} PF"></td>
            <td class="${GmailClasses.CELL} oZ-x3"></td>
            <td class="${GmailClasses.CELL} apU"></td>
            <td class="spacer ${GmailClasses.CELL} ${spacerClass}"></td>
            <td class="${GmailClasses.CELL} yX">
                <div class="bundle-and-count">
                    <span>${displayLabel}</span>
                    <span class="bundle-count">(${displayedMessageCount})</span>
                </div>
            </td>
            <td class="${GmailClasses.CELL} ${GmailClasses.SUBJECT_CELL}">
                <span class="bundle-senders">
                    ${sendersText}
                </span>
            </td>
            <td class="${GmailClasses.CELL} flex-grow"></td>
        </tr>
    `;

    const bulkArchiveButton = BulkArchiveButton.create(messages);
    const bulkArchiveTd = DomUtils.htmlToElement(`<td class="${GmailClasses.CELL}"></td>`);
    bulkArchiveTd.appendChild(bulkArchiveButton);

    const labelQuery = labels
        .map(l => 'label%3A' + l
            .split(' ').join('-')
            .split('/').join('%2F')
            .split('&').join('-'))
        .join('+');
    const url = `${baseUrl}#search/label%3AInbox+${labelQuery}`;
    const viewAllButtonHtml = `
        <td class="${GmailClasses.CELL}">
            <a 
                href="${url}" 
                class="view-all-link"
            >
                <div class="view-all">
                    View all
                </div>
            </a>
        </td>
    `;

    const bundleDateHtml = `
        <td class="bundle-date-cell ${snoozedText ? '' : GmailClasses.DATE_CELL} ${GmailClasses.CELL}">
            <span class="bundle-date ${latestIsUnreadClass} ${latestIsSnoozedClass}">
                ${latestDate}
            </span>
        </td>
    `;

    const el = DomUtils.htmlToElement(html);
    el.appendChild(bulkArchiveTd);
    el.appendChild(DomUtils.htmlToElement(bundleDateHtml));
    // A custom bundle has no Gmail label to search, so it gets no "View all"
    // link — an empty cell keeps the row's column layout aligned.
    el.appendChild(DomUtils.htmlToElement(
        isCustom ? `<td class="${GmailClasses.CELL}"></td>` : viewAllButtonHtml));

    el.addEventListener('click', e => {
        if (!e.target.matches(`.${InbundlyClasses.VIEW_ALL_LINK}`) &&
            !e.target.matches('.view-all'))
        {
            toggleBundle(label);
        }

        // Don't propagate to handler for click-outside to close bundle
        e.stopPropagation();
    });
    el.style.order = order;

    if (labelColors) {
        el.classList.add(InbundlyClasses.LABEL_COLORED);
        el.style.setProperty('--inbundly-label-bg', labelColors.background);
        if (labelColors.color) {
            el.style.setProperty('--inbundly-label-fg', labelColors.color);
        }
        if (labelColors.accent) {
            el.style.setProperty('--inbundly-label-accent', labelColors.accent);
        }
        // Gray/neutral theme-matched bundles blend more strongly so their fill
        // stands out from the theme background instead of matching it.
        if (labelColors.neutral) {
            el.style.setProperty('--inbundly-label-mix', '42%');
        }
    }

    return el;
}

function _generateSendersText(messages) {
    const dedupedSenders = [];
    const unreadStatusBySenders = {};

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const sendersElements = [...message.querySelectorAll(Selectors.SENDERS)];;
        
        for (let j = sendersElements.length - 1; j >= 0; j--) {
            const sender = sendersElements[j].innerText;
            if (!unreadStatusBySenders.hasOwnProperty(sender)) {
                dedupedSenders.push(sender);
            }
            const isUnread = sendersElements[j].classList.contains(GmailClasses.UNREAD_SENDER);
            unreadStatusBySenders[sender] = !!unreadStatusBySenders[sender] || isUnread;
        }
    }

    return dedupedSenders.map(s => 
        unreadStatusBySenders[s] ? `<span class="unread-sender">${s}</span>` : s)
}

export default { create };