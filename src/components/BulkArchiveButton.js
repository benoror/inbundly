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

import ArchiveAction from '../util/ArchiveAction';
import DomUtils from '../util/DomUtils';
import { GmailClasses } from '../util/Constants';

/**
 * Create bulk archive button for archiving the given messages, which should
 * be in the same bundle or the same date section. The click goes through
 * ArchiveAction, which applies the archive switches (skip starred, mark read,
 * unstar) before driving Gmail's toolbar Archive.
 */
function create(messages) {
    const html = `
        <span class="archive-bundle ${GmailClasses.ARCHIVE_BUTTON}">
        </span>
    `;

    const archiveSpan = DomUtils.htmlToElement(html);
    archiveSpan.addEventListener('click', e =>  {
        if (archiveSpan.classList.contains('disabled')) {
            e.stopPropagation();
            return;
        }

        ArchiveAction.archive(messages);
        e.stopPropagation();
    });

    return archiveSpan;
}

export default { create };
