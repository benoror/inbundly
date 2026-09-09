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
import {
    GmailClasses,
    InbundlyClasses,
    Selectors,
} from '../util/Constants';

/**
 * Create a select-all checkbox for the given messages, which should be in the
 * same bundle. Selection goes through Gmail's own per-message checkboxes, so
 * Gmail's toolbar actions (Archive, Delete, Mark as read, ...) apply to the
 * selection as usual.
 *
 * The checkbox doesn't track its own state: InbundlyStyler restyles it (via
 * aria-checked and Gmail's checked/indeterminate classes) when Gmail applies
 * the selection to the message rows. Gmail's own stylesheet draws it, since
 * it carries Gmail's material-checkbox classes.
 */
function create(messages) {
    const html = `
        <span
            class="${InbundlyClasses.BUNDLE_CHECKBOX} ${GmailClasses.CHECKBOX}"
            role="checkbox"
            aria-checked="false"
            aria-label="Select all messages in this bundle"
            tabindex="0"
        ></span>
    `;

    const checkbox = DomUtils.htmlToElement(html);
    checkbox.addEventListener('click', e => {
        _toggleMessages(messages);
        // Don't toggle the bundle open/closed.
        e.stopPropagation();
    });
    checkbox.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') {
            _toggleMessages(messages);
            e.preventDefault();
            e.stopPropagation();
        }
    });

    return checkbox;
}

/**
 * Select all messages, or deselect them all if every one is already selected.
 */
function _toggleMessages(messages) {
    const checkboxNodes = messages
        .map(m => m.querySelector(Selectors.MESSAGE_CHECKBOX))
        .filter(Boolean);
    const allChecked = checkboxNodes.every(DomUtils.isChecked);

    if (allChecked) {
        checkboxNodes.forEach(node => node.click());
        return;
    }
    checkboxNodes
        .filter(node => !DomUtils.isChecked(node))
        .forEach(node => node.click());
}

export default { create };
