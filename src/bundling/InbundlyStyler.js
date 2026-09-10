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
} from '../util/Constants';

/**
 * Applies inbundly styling.
 */
class InbundlyStyler {
    constructor(bundledMail) {
        this.bundledMail = bundledMail;
    }

    /**
     * Apply "selected" styling (i.e. checked) to all bundles that have any messages that
     * are selected.
     */
    markSelectedBundles() {
        this.bundledMail.getAllBundles().forEach(this._markSelectedBundle);
    }

    /**
     * Apply "selected" styling (i.e. checked) to all bundles with the given labels, that have
     * any messages that are selected. A label can bundle in more than one section,
     * so mark every matching bundle.
     */
    markSelectedBundlesFor(labels) {
        labels.forEach(l => {
            this.bundledMail.findBundlesByLabel(l).forEach(this._markSelectedBundle);
        });
    }

    /**
     * Apply "selected" styling to the bundle, and mirror how much of it is
     * selected onto its select-all checkbox (none/some/all).
     */
    _markSelectedBundle(bundle) {
        const messages = bundle.getMessages();
        const selectedCount = messages
            .filter(m => m.classList.contains(GmailClasses.SELECTED))
            .length;

        const bundleRow = bundle.getBundleRow();
        bundleRow.classList.toggle(GmailClasses.SELECTED, selectedCount > 0);

        const checkbox = bundleRow.querySelector(
            `.${InbundlyClasses.BUNDLE_CHECKBOX}`);
        if (checkbox) {
            const checkedState = selectedCount === 0
                ? 'false'
                : (selectedCount === messages.length ? 'true' : 'mixed');
            checkbox.setAttribute('aria-checked', checkedState);
            // Gmail's stylesheet draws the checked/indeterminate icons from
            // these state classes, not from aria-checked.
            checkbox.classList.toggle(
                GmailClasses.CHECKBOX_CHECKED, checkedState === 'true');
            checkbox.classList.toggle(
                GmailClasses.CHECKBOX_INDETERMINATE, checkedState === 'mixed');
        }
    }

    /**
     * For each bundle, disable the bulk actions (archive, snooze, delete) if any
     * message outside of its bundle is selected — a toolbar action would apply
     * to the whole selection.
     */
    disableBulkArchiveIfNecessary() {
        const selectedMessages = [].slice.call(
            document.querySelectorAll(Selectors.SELECTED));
        this.bundledMail.getAllBundles().forEach(bundle =>
            this._updateBulkActionButtons(bundle, selectedMessages));
    }

    /**
     * Enable/disable the bulk action buttons for the given bundle.
     */
    _updateBulkActionButtons(bundle, selectedMessages) {
        const bundledMessageIds = new Set(bundle.getMessages().map(m => m.id));
        const allSelectedMessagesInBundle = !selectedMessages.some(
            m => !bundledMessageIds.has(m.id));

        bundle.getBundleRow()
            .querySelectorAll('.archive-bundle, .snooze-bundle, .delete-bundle')
            .forEach(button =>
                button.classList.toggle('disabled', !allSelectedMessagesInBundle));
    }
}

export default InbundlyStyler;