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

/**
 * The master on/off switch for bundling, shown in Gmail's top bar next to the
 * pinned-messages toggle. It persists the `bundlingEnabled` option to
 * chrome.storage.sync; content.js reacts to that change (bundling/unbundling the
 * list live) via its storage.onChanged listener. The switch also mirrors changes
 * made on the other surfaces (Options page, toolbar popup) so all stay in sync.
 */
class BundlingToggle {
    constructor() {
        this.enabled = true;

        this._toggle = this._toggle.bind(this);
        this._onStorageChanged = this._onStorageChanged.bind(this);

        chrome.storage.sync.get({ bundlingEnabled: true }, ({ bundlingEnabled }) => {
            this.enabled = !!bundlingEnabled;
            this._render();
        });

        chrome.storage.onChanged.addListener(this._onStorageChanged);
    }

    /**
     * Returns a toggle dom element that flips `bundlingEnabled` on click.
     */
    create() {
        const anchorElement = DomUtils.htmlToElement(`
            <a href="" title="Toggle bundling">
                <div class="slider">
                    <div class="slider-button"></div>
                </div>
            </a>
        `);
        anchorElement.addEventListener('click', this._toggle);

        const toggleElement = DomUtils.htmlToElement(`<div class="bundling-toggle"></div>`);
        toggleElement.appendChild(anchorElement);

        this.toggleElement = toggleElement;
        this._render();

        return this.toggleElement;
    }

    _toggle(e) {
        e.preventDefault();
        // Optimistically flip; the storage write drives the actual rebundle, and
        // the onChanged handler will re-sync if the write is corrected elsewhere.
        this.enabled = !this.enabled;
        this._render();
        chrome.storage.sync.set({ bundlingEnabled: this.enabled });
    }

    _onStorageChanged(changes, area) {
        if (area !== 'sync' || !changes.bundlingEnabled) {
            return;
        }
        const { newValue } = changes.bundlingEnabled;
        this.enabled = newValue === undefined ? true : !!newValue;
        this._render();
    }

    _render() {
        if (this.toggleElement) {
            this.toggleElement.classList.toggle('bundling-on', this.enabled);
        }
    }
}

export default BundlingToggle;
