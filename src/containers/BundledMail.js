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
    getCurrentPageNumber,
    getCurrentTab,
} from '../util/MessagePageUtils';

/**
 * The collection of bundled mail for the inbox.
 *
 * Keeps track of bundles for each page/tab of messages, and the current open
 * bundle. A page/tab can contain several independent sections (Priority Inbox,
 * Multiple Inboxes, "X first" splits), so bundles are keyed by section id as
 * well — the same label may bundle separately in two sections, and the open
 * bundle is identified by (sectionId, label), not label alone.
 */
class BundledMail {
    constructor() {
        // Bundles map, keyed by pageNumber, tab name, sectionId, and label.
        this._bundlesMap = {};
        // { sectionId, label } of the currently open bundle, or null.
        this._openedBundle = null;
    }

    /**
     * Get the bundle for the given section and label on the current page, or
     * undefined if there's no such bundle.
     */
    getBundleInSection(sectionId, label) {
        const sections = this._currentSections();
        return sections[sectionId] ? sections[sectionId][label] : undefined;
    }

    /**
     * Every bundle whose key is `label`, across all sections of the current
     * page — the same label can bundle independently in more than one section.
     */
    findBundlesByLabel(label) {
        return Object.values(this._currentSections())
            .map(bundlesByLabel => bundlesByLabel[label])
            .filter(Boolean);
    }

    /**
     * A flat list of every bundle on the current page, across all sections.
     */
    getAllBundles() {
        return Object.values(this._currentSections())
            .flatMap(bundlesByLabel => Object.values(bundlesByLabel));
    }

    /**
     * The bundle that is currently open, or null/undefined if none is (or the
     * open bundle no longer exists after a rebundle).
     */
    getOpenedBundle() {
        if (!this._openedBundle) {
            return null;
        }
        return this.getBundleInSection(
            this._openedBundle.sectionId, this._openedBundle.label);
    }

    /**
     * The { sectionId, label } reference of the open bundle, or null.
     */
    getOpenedBundleRef() {
        return this._openedBundle;
    }

    /**
     * Record that the bundle (sectionId, label) is currently open.
     */
    openBundle(sectionId, label) {
        this._openedBundle = { sectionId, label };
    }

    /**
     * Record that no bundles are open.
     */
    closeBundle() {
        this._openedBundle = null;
    }

    /**
     * Associate a section's bundlesByLabel with the given page number.
     */
    setBundles(bundlesByLabel, pageNumber, sectionId) {
        if (!this._bundlesMap[pageNumber]) {
            this._bundlesMap[pageNumber] = {};
        }
        const tab = getCurrentTab();
        if (!this._bundlesMap[pageNumber][tab]) {
            this._bundlesMap[pageNumber][tab] = {};
        }

        this._bundlesMap[pageNumber][tab][sectionId] = bundlesByLabel;
    }

    /**
     * Drop recorded sections whose id is >= `count` for the current page/tab.
     * A bundle pass calls this with the number of sections currently in the DOM,
     * so sections that disappeared when the inbox layout shrank (e.g. switching
     * from Priority Inbox to Default) don't leave orphaned bundles behind. It
     * only removes out-of-range sections, so still-bundled sections that the
     * pass skipped keep their persisted state.
     */
    pruneSectionsFrom(count) {
        const sections = this._currentSections();
        Object.keys(sections).forEach(id => {
            if (Number(id) >= count) {
                delete sections[id];
            }
        });
    }

    /**
     * Map of sectionId -> (label -> bundle) for the current page/tab.
     */
    _currentSections() {
        const page = this._bundlesMap[getCurrentPageNumber()];
        return (page && page[getCurrentTab()]) || {};
    }
}

export default BundledMail;