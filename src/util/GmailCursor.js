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

import {
    GmailClasses,
    InbundlyClasses,
    Selectors,
    TableBodySelectors,
    SECTION_ATTR,
} from './Constants';

// Gmail's keyboard cursor is the row that j/k walk and that e/x/#/Enter act on
// when nothing is checked. Gmail marks it with GmailClasses.CURSOR (`btb`) and
// keeps it in step with DOM focus: the message list is an ARIA grid whose rows
// are focusable, so Tab and the arrow keys land on the cursor row. Focusing a
// row is therefore the one lever a content script has to move the cursor.
//
// That coupling is an observation about Gmail, not an API. TESTING.md carries
// a manual canary for it; if Gmail ever stops following focus, the
// KeyboardNavHandler's toolbar fallbacks still act on the row the user sees.

// The row most recently focused through here. A last resort for finding the
// cursor when focus has moved to <body> (e.g. a click on empty space) and
// Gmail exposes no cursor mark.
let lastFocusedRow = null;

/**
 * True if `node` is a row in a section inbundly has bundled.
 */
function _isSectionRow(node) {
    return !!node &&
        !!node.matches &&
        node.matches(TableBodySelectors.MESSAGE_NODES) &&
        !!node.closest(`${Selectors.TABLE_BODY}[${SECTION_ATTR}]`);
}

/**
 * The row (message or bundle) that currently has DOM focus, or null when focus
 * is elsewhere (or nowhere).
 */
function getFocusedRow() {
    const active = document.activeElement;
    if (!active || !active.closest) {
        return null;
    }
    const row = active.closest(TableBodySelectors.MESSAGE_NODES);
    return _isSectionRow(row) ? row : null;
}

/**
 * The row Gmail currently marks as its cursor, or null. May be a row hidden
 * inside a collapsed bundle: Gmail walks its own list, not the visible one.
 */
function getMarkedRow() {
    return document.querySelector(Selectors.CURSOR_ROW);
}

/**
 * The row focused most recently through focusRow, if it is still in the
 * document; otherwise null.
 */
function getLastFocusedRow() {
    if (lastFocusedRow && !document.contains(lastFocusedRow)) {
        lastFocusedRow = null;
    }
    return lastFocusedRow;
}

/**
 * True if Gmail's cursor mark sits on `row`, i.e. Gmail agrees that this row is
 * the one its shortcuts act on.
 */
function isMarked(row) {
    return !!row && row.classList.contains(GmailClasses.CURSOR);
}

/**
 * Move the keyboard cursor to `row` by focusing it.
 *
 * For a Gmail message row, Gmail syncs its own cursor to the focused row and
 * draws its mark. For an inbundly bundle row Gmail knows nothing, so inbundly
 * draws its own cursor (InbundlyClasses.CURSOR) and clears Gmail's mark from
 * the row it lingers on, so the user sees exactly one cursor. Gmail's
 * internal cursor still points at that old row, which is why
 * KeyboardNavHandler intercepts thread shortcuts while a bundle row is the
 * cursor.
 */
function focusRow(row) {
    if (!row) {
        return;
    }

    document.querySelectorAll(`.${InbundlyClasses.CURSOR}`)
        .forEach(el => el.classList.remove(InbundlyClasses.CURSOR));

    if (row.classList.contains(InbundlyClasses.BUNDLE_ROW)) {
        row.classList.add(InbundlyClasses.CURSOR);
        document.querySelectorAll(Selectors.CURSOR_ROW)
            .forEach(el => el.classList.remove(GmailClasses.CURSOR));
    }

    if (!row.hasAttribute('tabindex')) {
        row.setAttribute('tabindex', '-1');
    }
    row.focus({ preventScroll: true });
    if (row.scrollIntoView) {
        row.scrollIntoView({ block: 'nearest' });
    }
    lastFocusedRow = row;
}

export default {
    getFocusedRow,
    getMarkedRow,
    getLastFocusedRow,
    isMarked,
    focusRow,
};
