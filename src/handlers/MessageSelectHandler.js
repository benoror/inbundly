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
} from '../util/Constants';
import DomUtils from '../util/DomUtils';
import { supportsBundling } from '../util/MessagePageUtils';
import InbundlyStyler from '../bundling/InbundlyStyler';

// Watch row class changes from a stable ancestor (role="main"). Gmail's list
// virtualization recreates the table body (and rows) on interaction — cloning
// our classes onto the new elements — which orphans any observer bound to the
// tbody or the rows. role="main" survives that, so one subtree observer there
// keeps catching class changes on whatever rows are currently live.
const MAIN_CONFIG = {
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true,
    childList: false,
    subtree: true,
};

/**
 * Reapplies inbundly's open-bundle styling when Gmail rewrites (or re-renders)
 * a message row's class on select/check, and mirrors a message's selected state
 * onto its bundle row.
 */
class MessageSelectHandler {

    constructor(bundledMail, selectiveBundling) {
        this.bundledMail = bundledMail;
        this.selectiveBundling = selectiveBundling;
        this.observer = null;
        this.observedMain = null;
        this.inbundlyStyler = new InbundlyStyler(bundledMail);

        this._handleMutations = this._handleMutations.bind(this);
    }

    /**
     * Ensure the single role="main" observer is attached. A bundle pass calls this
     * every bundle pass; it attaches on the first call and re-attaches only if
     * role="main" itself was replaced (e.g. navigation), so it stays alive across
     * passes that skip already-bundled sections.
     */
    startWatching() {
        const main = document.querySelector(Selectors.MAIN);
        if (!main || this.observedMain === main) {
            return;
        }
        if (this.observer) {
            this.observer.disconnect();
        }
        this.observer = new MutationObserver(this._handleMutations);
        this.observer.observe(main, MAIN_CONFIG);
        this.observedMain = main;
    }

    /**
     * Stop watching.
     */
    stopWatching() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.observer = null;
        this.observedMain = null;
    }

    _handleMutations(mutations) {
        if (!supportsBundling(window.location.href)) {
            return;
        }

        // The open bundle is identified by (sectionId, label). Membership is
        // decided from the LIVE row via findRelevantLabels — getOpenedBundle()'s
        // message element refs go stale when Gmail re-renders a row, but the
        // row's own labels (and thus its bundle key) do not.
        const openRef = this.bundledMail.getOpenedBundleRef();

        mutations.forEach(mutation => {
            if (mutation.attributeName !== 'class') {
                return;
            }
            const row = mutation.target;
            if (!row.matches || !row.matches(TableBodySelectors.MESSAGE_NODES) ||
                row.classList.contains(InbundlyClasses.BUNDLE_ROW)) {
                return;
            }

            const wasSelected = !!mutation.oldValue &&
                mutation.oldValue.includes(GmailClasses.SELECTED);
            const isSelected = row.classList.contains(GmailClasses.SELECTED);
            const selectionChanged = wasSelected !== isSelected;

            // Only a row missing our classes needs restoring; skip the label
            // lookup for the common case (e.g. hover) where nothing was dropped.
            const maybeRestore = !!openRef &&
                (!row.classList.contains(InbundlyClasses.BUNDLED_MESSAGE) ||
                    !row.classList.contains(InbundlyClasses.VISIBLE));

            if (!selectionChanged && !maybeRestore) {
                return;
            }

            const rowLabels = this.selectiveBundling.findRelevantLabels(row);

            // Restore the open bundle's rows: the indent lives on
            // `.bundled-message.visible`, so a class Gmail drops on select/check
            // shifts the row left. Scoped to the open bundle (by label + section),
            // so a collapsed bundle isn't reopened (close-safe).
            if (maybeRestore &&
                rowLabels.includes(openRef.label) &&
                DomUtils.getSectionId(row) === openRef.sectionId) {
                row.classList.add(InbundlyClasses.BUNDLED_MESSAGE);
                row.classList.add(InbundlyClasses.VISIBLE);
            }

            // Mirror the row's selected state onto its bundle row(s).
            if (selectionChanged) {
                // Gmail rewrites the row's class wholesale on select/deselect,
                // dropping inbundly's classes. The open bundle's rows are
                // restored above; re-hide a closed bundle's row here so it
                // doesn't pop out of its bundle while (de)selected.
                const sectionId = DomUtils.getSectionId(row);
                if (!row.classList.contains(InbundlyClasses.BUNDLED_MESSAGE) &&
                    rowLabels.some(
                        l => this.bundledMail.getBundleInSection(sectionId, l))) {
                    row.classList.add(InbundlyClasses.BUNDLED_MESSAGE);
                }

                this.inbundlyStyler.markSelectedBundlesFor(rowLabels);
                this.inbundlyStyler.disableBulkArchiveIfNecessary();
            }
        });
    }
}

export default MessageSelectHandler;
