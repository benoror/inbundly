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

import DomUtils from '../util/DomUtils';
import GmailToolbar from '../util/GmailToolbar';
import {
    GmailClasses,
    Selectors,
} from '../util/Constants';

/**
 * Create a snooze button for the given messages, which should be in the same
 * bundle. Clicking it selects the messages and clicks Gmail's own toolbar
 * snooze button, so Gmail's snooze menu opens for the whole bundle.
 */
function create(messages) {
    const html = `
        <span class="snooze-bundle ${GmailClasses.ARCHIVE_BUTTON}">
        </span>
    `;

    const snoozeSpan = DomUtils.htmlToElement(html);
    snoozeSpan.addEventListener('click', e => {
        if (snoozeSpan.classList.contains('disabled')) {
            e.stopPropagation();
            return;
        }

        GmailToolbar.triggerToolbarAction(
            Selectors.TOOLBAR_SNOOZE_BUTTON,
            () => GmailToolbar.selectMessages(messages));
        e.stopPropagation();
    });

    return snoozeSpan;
}

export default { create };
