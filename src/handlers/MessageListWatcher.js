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

// subtree: true so row-level changes are seen too: on a slow first paint Gmail
// streams the rest of the page's rows into the ALREADY-BUNDLED table (a
// childList change on the tbody, two levels below the list container), which
// left most of the page unbundled until something rebuilt the table. Safe from
// feedback loops: Bundler disconnects this watcher during each pass and
// re-attaches afterwards, so inbundly's own row insertions are never observed.
const OBSERVER_CONFIG = { attributes: false, childList: true, subtree: true };

/**
 * Wraps a mutation observer for an ancestor of the message list tables.
 *
 * In addition to manually refreshes triggered by the user, Gmail occasionally replaces the children
 * of this dom element, resulting in the message list getting redrawn to its original
 * unbundled state.
 */
class MessageListWatcher {
    constructor(callback) {
        this.observer = new MutationObserver(callback);
    }

    observe() {
        // Watch every section's list — one MutationObserver can watch many
        // targets, so redraws in any section trigger a rebundle.
        DomUtils.getSectionMessageLists().forEach(
            list => this.observer.observe(list, OBSERVER_CONFIG));
    }

    disconnect() {
        this.observer.disconnect();
    }
}

export default MessageListWatcher;