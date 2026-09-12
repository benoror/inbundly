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
import GmailCursor from '../util/GmailCursor';
import GmailToolbar from '../util/GmailToolbar';
import {
    InbundlyClasses,
    Selectors,
    TableBodySelectors,
} from '../util/Constants';

// Gmail's list is flex-reordered, so the rows a user sees are not the rows
// Gmail's own j/k walk (Gmail steps through its DOM-ordered thread list, which
// includes threads hidden inside collapsed bundles and knows nothing about
// bundle rows). This handler owns list navigation while bundling is active:
//  - j/k (and the arrow keys, when focus is already in the list) step through
//    the VISIBLE rows in display order: plain messages, bundle rows, and the
//    open bundle's threads;
//  - on a bundle row, Enter/o toggle it, x selects it, and e/#/b run the
//    row's archive/delete/snooze actions (only when that button is shown and
//    enabled); the other thread shortcuts are swallowed, because Gmail's own
//    cursor is on some other thread and would act on that instead;
//  - Escape from inside the open bundle collapses it.
// Moving onto a message row goes through GmailCursor.focusRow so Gmail's own
// shortcuts act on it. When Gmail's cursor mark disagrees with the focused row
// (and nothing is checked), the most common shortcuts fall back to Gmail's
// toolbar/checkbox on the visible row instead of passing through.

const NEXT_KEYS = new Set(['j', 'ArrowDown']);
const PREV_KEYS = new Set(['k', 'ArrowUp']);
const ARROW_KEYS = new Set(['ArrowDown', 'ArrowUp']);

// Gmail single-key shortcuts that act on the cursor thread. On a bundle row
// these are either mapped to a bundle action below or swallowed.
const THREAD_ACTION_KEYS = new Set([
    'e', 'y', '#', 'x', 's', '!', 'b', 'v', 'l', 'm', 'I', 'U',
    'r', 'a', 'f', '.', 'T', '_', '+', '=', '-', 'Enter', 'o',
]);
const HANDLED_KEYS = new Set([...NEXT_KEYS, ...PREV_KEYS, ...THREAD_ACTION_KEYS, 'Escape']);

// Where a keystroke belongs to something else: text entry, dialogs and menus,
// and focusable controls with their own key handling (the bundle checkbox,
// the "View all" link).
const TYPING_CONTEXT = [
    'input', 'textarea', 'select',
    '[contenteditable=""]', '[contenteditable="true"]',
    '[role="textbox"]', '[role="combobox"]', '[role="dialog"]',
    '[role="alertdialog"]', '[role="menu"]', '[role="listbox"]',
].join(', ');
const INTERACTIVE_CONTROL = [
    'a', 'button', '[role="button"]', '[role="checkbox"]',
    '[role="link"]', '[role="menuitem"]',
].join(', ');

class KeyboardNavHandler {
    /**
     * `isActive` answers whether bundling currently applies to the page (master
     * switch on, inbox URL); the handler stays out of the way otherwise.
     */
    constructor(bundledMail, bundleToggler, isActive) {
        this.bundledMail = bundledMail;
        this.bundleToggler = bundleToggler;
        this.isActive = isActive;
        this.attached = false;

        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Listen in the capture phase so a handled key never reaches Gmail's own
     * shortcut handler, which would move its cursor onto a hidden row.
     */
    attach() {
        if (this.attached) {
            return;
        }
        document.addEventListener('keydown', this.handleKeyDown, true);
        this.attached = true;
    }

    detach() {
        document.removeEventListener('keydown', this.handleKeyDown, true);
        this.attached = false;
    }

    handleKeyDown(e) {
        // Synthetic keys (ours or another extension's) are meant for Gmail.
        if (!e.isTrusted || e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }
        if (!HANDLED_KEYS.has(e.key) || !this.isActive()) {
            return;
        }
        const target = e.target;
        if (target && target.closest &&
            (target.closest(TYPING_CONTEXT) || target.closest(INTERACTIVE_CONTROL))) {
            return;
        }

        const rows = this.getNavigableRows();
        if (!rows.length) {
            return;
        }
        const current = this.getCurrentRow(rows);

        if (NEXT_KEYS.has(e.key) || PREV_KEYS.has(e.key)) {
            // Arrow keys only when focus is already in the list; elsewhere they
            // scroll or drive whatever Gmail control has focus.
            if (ARROW_KEYS.has(e.key) && !GmailCursor.getFocusedRow()) {
                return;
            }
            this._move(rows, current, NEXT_KEYS.has(e.key) ? 1 : -1);
            this._swallow(e);
            return;
        }

        if (!current) {
            return;
        }
        if (current.classList.contains(InbundlyClasses.BUNDLE_ROW)) {
            this._handleBundleRowKey(e, current);
        }
        else {
            this._handleMessageRowKey(e, current);
        }
    }

    /**
     * The rows a keyboard user can land on, in display order across every
     * visible section: plain message rows, bundle rows, and the open bundle's
     * threads. Rows hidden in collapsed bundles are skipped. Display order is
     * the flex `order` inbundly assigns (ties keep DOM order).
     */
    getNavigableRows() {
        const rows = [];
        DomUtils.getSectionMessageLists().forEach(messageList => {
            const tableBody = messageList.querySelector(Selectors.TABLE_BODY);
            if (!tableBody) {
                return;
            }
            const sectionRows = [...tableBody.querySelectorAll(TableBodySelectors.MESSAGE_NODES)]
                .filter(row =>
                    row.classList.contains(InbundlyClasses.BUNDLE_ROW) ||
                    !row.classList.contains(InbundlyClasses.BUNDLED_MESSAGE) ||
                    row.classList.contains(InbundlyClasses.VISIBLE))
                .map((row, index) => ({ row, index, order: KeyboardNavHandler._order(row) }))
                .sort((a, b) => (a.order - b.order) || (a.index - b.index))
                .map(entry => entry.row);
            rows.push(...sectionRows);
        });
        return rows;
    }

    /**
     * The row the keyboard cursor is on, resolved to one of `rows`: the focused
     * row, else the row Gmail marks, else the row last focused here. A cursor
     * that sits on a thread hidden inside a collapsed bundle resolves to that
     * bundle's row, so the next step continues from where the user sees the
     * cursor. Null when there is no usable cursor.
     */
    getCurrentRow(rows) {
        const candidates = [
            GmailCursor.getFocusedRow(),
            GmailCursor.getMarkedRow(),
            GmailCursor.getLastFocusedRow(),
        ];
        for (const candidate of candidates) {
            const resolved = this._resolve(candidate, rows);
            if (resolved) {
                return resolved;
            }
        }
        return null;
    }

    _resolve(row, rows) {
        if (!row || !document.contains(row)) {
            return null;
        }
        if (rows.includes(row)) {
            return row;
        }
        const bundle = this._bundleContaining(row);
        if (bundle && rows.includes(bundle.getBundleRow())) {
            return bundle.getBundleRow();
        }
        return null;
    }

    _move(rows, current, delta) {
        const index = current ? rows.indexOf(current) : -1;
        const target = index === -1
            ? (delta > 0 ? rows[0] : rows[rows.length - 1])
            : rows[index + delta];
        if (target) {
            GmailCursor.focusRow(target);
        }
    }

    _handleBundleRowKey(e, bundleRow) {
        const bundle = this._bundleForRow(bundleRow);
        if (!bundle) {
            return;
        }
        const html = document.documentElement;

        switch (e.key) {
            case 'Enter':
            case 'o':
                this.bundleToggler.toggleBundle(bundle.getSectionId(), bundle.getLabel());
                break;
            case 'Escape':
                if (this._isOpen(bundle)) {
                    this.bundleToggler.toggleBundle(bundle.getSectionId(), bundle.getLabel());
                    GmailCursor.focusRow(bundleRow);
                }
                else {
                    return;
                }
                break;
            case 'x':
                this._click(bundleRow.querySelector(`.${InbundlyClasses.BUNDLE_CHECKBOX}`));
                break;
            case 'e':
            case 'y':
                this._clickBundleAction(
                    bundleRow, '.archive-bundle', html, InbundlyClasses.HIDE_BUNDLE_ARCHIVE);
                break;
            case '#':
                this._clickBundleAction(
                    bundleRow, '.delete-bundle', html, InbundlyClasses.HIDE_BUNDLE_DELETE);
                break;
            case 'b':
                this._clickBundleAction(
                    bundleRow, '.snooze-bundle', html, InbundlyClasses.HIDE_BUNDLE_SNOOZE);
                break;
            default:
                if (!THREAD_ACTION_KEYS.has(e.key)) {
                    return;
                }
                // Gmail's cursor is on some other thread; acting on it would
                // not be what the user is looking at.
                break;
        }
        this._swallow(e);
    }

    /**
     * Keys on a visible message row. Gmail handles these itself when its cursor
     * mark is on the row (the normal case). When it is not, and nothing is
     * checked, the common shortcuts are routed through Gmail's toolbar and
     * checkbox on THIS row rather than left to act on Gmail's stale cursor.
     */
    _handleMessageRowKey(e, row) {
        if (e.key === 'Escape') {
            const open = this.bundledMail.getOpenedBundle();
            if (open && open.getMessages().includes(row)) {
                this.bundleToggler.toggleBundle(open.getSectionId(), open.getLabel());
                GmailCursor.focusRow(open.getBundleRow());
                this._swallow(e);
            }
            return;
        }

        if (GmailCursor.isMarked(row) || document.querySelector(Selectors.SELECTED)) {
            return;
        }

        switch (e.key) {
            case 'e':
            case 'y':
                this._toolbarAction(Selectors.TOOLBAR_ARCHIVE_BUTTON, row);
                break;
            case '#':
                this._toolbarAction(Selectors.TOOLBAR_DELETE_BUTTON, row);
                break;
            case 'b':
                this._toolbarAction(Selectors.TOOLBAR_SNOOZE_BUTTON, row);
                break;
            case 'x':
                this._click(row.querySelector(Selectors.MESSAGE_CHECKBOX));
                break;
            case 'Enter':
            case 'o':
                this._click(row);
                break;
            default:
                return;
        }
        this._swallow(e);
    }

    _toolbarAction(buttonSelector, row) {
        GmailToolbar.triggerToolbarAction(
            buttonSelector,
            () => GmailToolbar.selectMessages([row]));
    }

    _clickBundleAction(bundleRow, buttonSelector, html, hiddenClass) {
        if (html.classList.contains(hiddenClass)) {
            return;
        }
        const button = bundleRow.querySelector(buttonSelector);
        if (button && !button.classList.contains('disabled')) {
            this._click(button);
        }
    }

    _click(element) {
        if (element) {
            element.click();
        }
    }

    _swallow(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    _isOpen(bundle) {
        return this.bundledMail.getOpenedBundle() === bundle;
    }

    _bundleForRow(bundleRow) {
        return this.bundledMail.getAllBundles()
            .find(bundle => bundle.getBundleRow() === bundleRow) || null;
    }

    _bundleContaining(row) {
        return this.bundledMail.getAllBundles()
            .find(bundle => bundle.getMessages().includes(row)) || null;
    }

    static _order(row) {
        const order = parseInt(row.style.order, 10);
        return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
    }
}

export default KeyboardNavHandler;
