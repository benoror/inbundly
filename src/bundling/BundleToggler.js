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

import { getCurrentPageNumber } from '../util/MessagePageUtils';
import { 
    InbundlyClasses, 
    Selectors, 
    ORDER_INCREMENT,
} from '../util/Constants';

/**
 * Opens/closes bundles to show/hide bundled messages.
 */
class BundleToggler {
    constructor(bundledMail) {
        this.bundledMail = bundledMail;
        
        this.toggleBundle = this.toggleBundle.bind(this);
        this.openBundle = this.openBundle.bind(this);
        this.closeAllBundles = this.closeAllBundles.bind(this);
    }

    toggleBundle(sectionId, label) {
        const opened = this.bundledMail.getOpenedBundleRef();

        if (opened) {
            this.closeAllBundles();
        }

        const sameBundle =
            opened && opened.sectionId === sectionId && opened.label === label;
        if (!sameBundle) {
            this.openBundle(sectionId, label);
        }
    }

    openBundle(sectionId, label) {
        this.bundledMail.openBundle(sectionId, label);
        const bundle = this.bundledMail.getBundleInSection(sectionId, label);

        // Set order for bundled messages and make them visible
        const messages = bundle.getMessages();
        messages.forEach((el, i) => {
            el.style.order = bundle.getOrder() + i + 1;
            el.classList.add(InbundlyClasses.VISIBLE);

            if (i === messages.length - 1) {
                el.classList.add(InbundlyClasses.LAST);
            }

            // Hide redundant labels
            el.querySelectorAll(Selectors.LABEL_CONTAINERS).forEach(lc => {
                if (lc.childNodes[0].title === label) {
                    lc.style.display = 'none';
                }
            });
        });

        const bundleRow = bundle.getBundleRow();
        bundleRow.classList.add(InbundlyClasses.VISIBLE);
        // Remove top margin when bundle row follows a date divider
        if (bundleRow.previousSibling && 
            bundleRow.previousSibling.classList.contains('date-row') &&
            bundle.getOrder() - bundleRow.previousSibling.style.order <= ORDER_INCREMENT)
        {
            bundleRow.style.marginTop = '0';
        }

        this._showBundleArea(bundle);
    }

    closeAllBundles() {
        if (!this.bundledMail.getOpenedBundleRef()) {
            return;
        }

        this.bundledMail.closeBundle();

        // Remove styles that were added when the bundle was opened
        document.querySelectorAll(`.${InbundlyClasses.BUNDLED_MESSAGE}.${InbundlyClasses.VISIBLE}`)
            .forEach(el => {
                el.style.order = '';
                el.classList.remove(InbundlyClasses.VISIBLE);
                el.classList.remove(InbundlyClasses.LAST);

                // Unhide labels
                el.querySelectorAll(Selectors.LABEL_CONTAINERS).forEach(lc => {
                    if (lc.style.display) {
                        lc.style.display = '';
                    }
                });
            });

        document.querySelectorAll(`.${InbundlyClasses.BUNDLE_ROW}.${InbundlyClasses.VISIBLE}`)
            .forEach(el => {
                el.classList.remove(InbundlyClasses.VISIBLE);
                el.style.marginTop = '';
            });        

        document.querySelectorAll('.bundle-area')
            .forEach(bundleArea => bundleArea.style.display = '');
    }

    _showBundleArea(bundle) {
        // Each section has its own .bundle-area (appended to its table body).
        // Scope to the opened bundle's section so the highlight frames the right
        // list when several sections are visible at once.
        const tableBody = bundle.getBundleRow().closest(Selectors.TABLE_BODY);
        const bundleArea = tableBody.querySelector('.bundle-area');
        bundleArea.style.display = 'block';

        const top = BundleToggler._calculateBundleAreaTop(bundle.getBundleRow());
        bundleArea.style.top = `${top}px`;

        const height = BundleToggler._calculateBundleAreaHeight(bundle.getMessages());
        bundleArea.style.height = `${height}px`;

        this._applyLabelColor(bundleArea, bundle.getBundleRow());
    }

    /**
     * Carry the opened bundle's label color (stashed on its bundle row) onto the
     * shared bundle area, so the color scheme surrounds the open threads too.
     * When the bundle isn't label-colored, clear any color left from a previous open.
     */
    _applyLabelColor(bundleArea, bundleRow) {
        if (bundleRow.classList.contains(InbundlyClasses.LABEL_COLORED)) {
            bundleArea.classList.add(InbundlyClasses.LABEL_COLORED);
            bundleArea.style.setProperty(
                '--inbundly-label-bg', bundleRow.style.getPropertyValue('--inbundly-label-bg'));
            bundleArea.style.setProperty(
                '--inbundly-label-fg', bundleRow.style.getPropertyValue('--inbundly-label-fg'));
            bundleArea.style.setProperty(
                '--inbundly-label-accent', bundleRow.style.getPropertyValue('--inbundly-label-accent'));
        }
        else {
            bundleArea.classList.remove(InbundlyClasses.LABEL_COLORED);
            bundleArea.style.removeProperty('--inbundly-label-bg');
            bundleArea.style.removeProperty('--inbundly-label-fg');
            bundleArea.style.removeProperty('--inbundly-label-accent');
        }
    }

    static _calculateBundleAreaTop(bundleRow) {
        return bundleRow.offsetTop + bundleRow.offsetHeight;
    }

    static _calculateBundleAreaHeight(messages) {
        return (messages[messages.length - 1].offsetTop - messages[0].offsetTop) + 
            messages[messages.length - 1].offsetHeight;
    }
}

export default BundleToggler;