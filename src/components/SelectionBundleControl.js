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
import { InbundlyClasses, Selectors } from '../util/Constants';
import { supportsBundling } from '../util/MessagePageUtils';

/**
 * A floating control for building ad-hoc custom bundles out of the currently
 * selected messages. It appears when one or more messages are checkbox-selected
 * and disappears otherwise.
 *
 * When every selected message is already in a custom bundle the control offers
 * to remove them; otherwise it offers to bundle them (into a new or existing
 * custom bundle, named by the user). Writes go to CustomBundles, whose stored
 * change drives the re-render (and rides Chrome sync to other devices).
 *
 * The control is entirely inbundly-owned and positioned over the page, so it does
 * not depend on Gmail's toolbar markup. Selection is recomputed on any click or
 * key event, which covers checkbox clicks, select-all, and keyboard selection.
 */
class SelectionBundleControl {
    constructor(customBundles) {
        this.customBundles = customBundles;
        this._scheduled = false;

        this.button = DomUtils.htmlToElement(
            `<button type="button" class="inbundly-bundle-selected">
                <span class="inbundly-bundle-selected-icon">&#9783;</span>
                <span class="inbundly-bundle-selected-label"></span>
            </button>`);
        this.label = this.button.querySelector('.inbundly-bundle-selected-label');
        this.button.addEventListener('click', e => {
            e.stopPropagation();
            this._onClick();
        });

        const onInteraction = () => this._scheduleUpdate();
        document.addEventListener('click', onInteraction, true);
        document.addEventListener('keyup', onInteraction, true);
    }

    /**
     * Attach the control to the page. Safe to call once inbundly is active.
     */
    attach() {
        if (!this.button.isConnected) {
            document.body.appendChild(this.button);
        }
        this.update();
    }

    _scheduleUpdate() {
        if (this._scheduled) {
            return;
        }
        this._scheduled = true;
        requestAnimationFrame(() => {
            this._scheduled = false;
            this.update();
        });
    }

    _selectedRows() {
        return [...document.querySelectorAll(Selectors.SELECTED)];
    }

    _selectedThreadIds() {
        return this._selectedRows()
            .map(r => DomUtils.getThreadId(r))
            .filter(Boolean);
    }

    /**
     * Recompute visibility and the button's mode (bundle vs. remove) from the
     * current selection.
     */
    update() {
        // Only offer bundling where bundles are shown (the inbox), not on pages
        // like Sent or Search where a custom bundle wouldn't render.
        const threadIds = supportsBundling(window.location.href)
            ? this._selectedThreadIds()
            : [];
        const count = threadIds.length;
        this.button.classList.toggle(InbundlyClasses.VISIBLE, count > 0);
        if (count === 0) {
            return;
        }

        const allBundled = threadIds.every(id => this.customBundles.keyForThread(id));
        this._removeMode = allBundled;
        this.label.textContent = allBundled
            ? `Remove ${count} from bundle`
            : `Bundle ${count} selected`;
    }

    _onClick() {
        const threadIds = this._selectedThreadIds();
        if (!threadIds.length) {
            return;
        }

        if (this._removeMode) {
            this.customBundles.removeThreads(threadIds);
            return;
        }

        const name = this._promptForName(threadIds.length);
        if (name) {
            this.customBundles.addToBundle(name, threadIds);
        }
    }

    _promptForName(count) {
        const existing = this.customBundles.names();
        const hint = existing.length
            ? `\n\nExisting bundles (type one to add to it): ${existing.join(', ')}`
            : '';
        const answer = window.prompt(
            `Bundle ${count} selected message(s) together.\nName this bundle:${hint}`);
        return answer ? answer.trim() : '';
    }
}

export default SelectionBundleControl;
