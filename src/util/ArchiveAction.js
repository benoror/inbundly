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

import GmailToolbar from './GmailToolbar';
import { GmailClasses, Selectors } from './Constants';
import { OPTION_DEFAULTS, ARCHIVE_OPTION_KEYS } from './Options';

// What inbundly's own archive controls do: the archive-all icon on a bundle
// row (and its `e` / `y` shortcut) and the sweep on a date divider. Beyond
// selecting the threads and clicking Gmail's Archive, three Options switches
// shape the action, read at click time so a change applies to the next click
// without a rebundle:
//  - skipStarredOnArchive: starred (pinned) threads stay where they are, the
//    way Inbox's sweep left pins alone (#40);
//  - markReadOnArchive: the threads are marked read first, through Gmail's
//    own toolbar "Mark as read", so a label shown only with unread mail goes
//    quiet once its bundle is done (#48);
//  - unstarOnArchive: the stars come off the threads being archived, so done
//    threads stop lingering in Starred (#48).
// Gmail's own archive paths (the row's hover icon, the toolbar on a manual
// selection, `e` on a thread) are left to Gmail.

const DEFAULTS = Object.fromEntries(
    ARCHIVE_OPTION_KEYS.map(key => [key, OPTION_DEFAULTS[key]]));
const options = { ...DEFAULTS };

/**
 * Read the stored switches. content.js waits on this before the first bundle
 * pass, like the other option holders, so a click never sees the defaults
 * ahead of the user's values.
 */
function loadOptions() {
    return new Promise(resolve => {
        chrome.storage.sync.get(DEFAULTS, stored => {
            applyOptions(stored);
            resolve();
        });
    });
}

/**
 * Apply archive switches (initial load or a chrome.storage.onChanged sync).
 * Only keys present on `changed` are applied.
 */
function applyOptions(changed = {}) {
    for (const key of ARCHIVE_OPTION_KEYS) {
        if (key in changed) {
            options[key] = !!changed[key];
        }
    }
}

function getOptions() {
    return { ...options };
}

function isStarred(message) {
    return !!message.querySelector(Selectors.STARRED);
}

function isUnread(message) {
    return message.classList.contains(GmailClasses.UNREAD);
}

/**
 * The subset of `messages` archive-all acts on under the current switches:
 * everything, or everything but the starred threads.
 */
function archivable(messages) {
    return options.skipStarredOnArchive
        ? messages.filter(message => !isStarred(message))
        : [...messages];
}

/**
 * Archive `messages` through Gmail's toolbar, applying the switches. Returns
 * the threads handed to Gmail; an empty list means there was nothing left to
 * archive (every thread starred, skip on) and Gmail was not touched at all.
 */
function archive(messages) {
    const targets = archivable(messages);
    if (!targets.length) {
        return [];
    }
    const skipped = messages.filter(message => !targets.includes(message));

    // Before Gmail's Archive takes the rows away. Gmail's star is a plain
    // click target; no mousedown, so StarHandler's scroll anchoring (a user
    // gesture concern) stays out of it.
    if (options.unstarOnArchive) {
        targets.filter(isStarred).forEach(unstar);
    }

    const markRead = options.markReadOnArchive && targets.some(isUnread);
    GmailToolbar.triggerToolbarAction(
        Selectors.TOOLBAR_ARCHIVE_BUTTON,
        () => {
            // A skipped thread the user had checked by hand would ride along
            // with the toolbar action; it stays out with the others.
            GmailToolbar.deselectMessages(skipped);
            GmailToolbar.selectMessages(targets);
        },
        { precededBy: markRead ? Selectors.TOOLBAR_MARK_READ_BUTTON : null });

    return targets;
}

function unstar(message) {
    const star = message.querySelector(Selectors.STARRED);
    if (star) {
        star.click();
    }
}

export default {
    loadOptions,
    applyOptions,
    getOptions,
    archivable,
    archive,
};
