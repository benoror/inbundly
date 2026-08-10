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
} from '../util/Constants';
import DomUtils from '../util/DomUtils';
import { supportsBundling } from '../util/MessagePageUtils';
import InbundlyStyler from '../bundling/InbundlyStyler';

const MESSAGE_LIST_CONFIG = { 
    attributes: true,
    childList: false,
    subtree: false,
    attributeOldValue: true,
};

/**
 * Observers to handle when messages' checkboxes are clicked.
 *
 * Reapplies inbundly styling when Gmail applies its original styles when a message is selected.
 */
class MessageSelectHandler {

    constructor(bundledMail, selectiveBundling) {
        this.bundledMail = bundledMail;
        this.selectiveBundling = selectiveBundling;
        this.messageObservers = [];
        this.inbundlyStyler = new InbundlyStyler(bundledMail);

        this._handleMessageChange = this._handleMessageChange.bind(this);
    }

    /**
     * Start observing the given messages, adding to any already being watched.
     * A bundle pass calls this once per section, so observers accumulate across
     * sections; stopWatching() clears them at the start of the next full pass.
     */
    startWatching(messageElements) {
        const observers = messageElements.map(el => {
            const observer = new MutationObserver(this._handleMessageChange);
            observer.observe(el, MESSAGE_LIST_CONFIG);
            return observer;
        });
        this.messageObservers = this.messageObservers.concat(observers);
    }

    /**
     * Stop watching all messages.
     */
    stopWatching() {
        this.messageObservers.forEach(o => o.disconnect());
        this.messageObservers = [];
    }

    _handleMessageChange(mutations) {
        if (!supportsBundling(window.location.href)) {
            return;
        }

        mutations.forEach(mutation => {
            if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') {
                return;
            }

            const message = mutation.target;

            // Re-add inbundly styling that get removed when gmail applies checked/unchecked styling
            if (mutation.oldValue.includes(InbundlyClasses.BUNDLED_MESSAGE) &&
                !message.classList.contains(InbundlyClasses.BUNDLED_MESSAGE)) 
            {
                // Bundled message
                message.classList.add(InbundlyClasses.BUNDLED_MESSAGE);
                if (mutation.oldValue.includes(InbundlyClasses.VISIBLE)) {
                    message.classList.add(InbundlyClasses.VISIBLE);
                }
                if (mutation.oldValue.includes(InbundlyClasses.LAST)) {
                    message.classList.add(InbundlyClasses.LAST);
                }
            }
            
            if (mutation.oldValue.includes(GmailClasses.SELECTED) !== 
                message.classList.contains(GmailClasses.SELECTED)) 
            {
                this.inbundlyStyler.markSelectedBundlesFor(
                    this.selectiveBundling.findRelevantLabels(message));
                this.inbundlyStyler.disableBulkArchiveIfNecessary();
            }
        });    
    }
}

export default MessageSelectHandler;