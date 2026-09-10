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
 * Create a delete/trash-all button for the given messages, which should be in
 * the same bundle. Clicking it selects the messages and clicks Gmail's own
 * toolbar Delete button, so Gmail moves the threads to Trash (and shows its
 * own undo toast). There is no Inbundly-side delete path.
 */
function create(messages) {
    const html = `
        <span class="delete-bundle ${GmailClasses.ARCHIVE_BUTTON}">
        </span>
    `;

    const deleteSpan = DomUtils.htmlToElement(html);
    deleteSpan.addEventListener('click', e => {
        if (deleteSpan.classList.contains('disabled')) {
            e.stopPropagation();
            return;
        }

        GmailToolbar.triggerToolbarAction(
            Selectors.TOOLBAR_DELETE_BUTTON,
            () => GmailToolbar.selectMessages(messages));
        e.stopPropagation();
    });

    return deleteSpan;
}

export default { create };
