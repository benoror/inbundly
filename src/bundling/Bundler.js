// inboxy: Chrome extension for Google Inbox-style bundles in Gmail.
// Copyright (C) 2020  Teresa Ou

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

import Bundle from '../containers/Bundle';

import BundleRow from '../components/BundleRow';
import DateDivider from '../components/DateDivider';

import QuickSelectHandler from '../handlers/QuickSelectHandler';
import MessageSelectHandler from '../handlers/MessageSelectHandler';

import InboxyStyler from './InboxyStyler';

import { 
    getCurrentPageNumber, 
    getCurrentBaseUrl,
} from '../util/MessagePageUtils';
import { 
    GmailClasses,
    InboxyClasses,
    Selectors,
    TableBodySelectors,
    ORDER_INCREMENT,
    Element,
    LABEL_SET_SEPARATOR,
} from '../util/Constants';
import DomUtils from '../util/DomUtils';
import { isCustomBundleKey } from '../util/CustomBundleKey';
import { detectThemeFlavor, flavorBase, snapToAccent, isNeutral } from '../util/ThemePalette';

/**
 * Groups messages into bundles, and renders those bundles.
 */
class Bundler {
    constructor(bundleToggler, bundledMail, messageListWatcher, selectiveBundling) {
        this.bundleToggler = bundleToggler;
        this.bundledMail = bundledMail;
        this.messageListWatcher = messageListWatcher;
        this.selectiveBundling = selectiveBundling;
        this.messageSelectHandler = new MessageSelectHandler(bundledMail, selectiveBundling);
        this.inboxyStyler = new InboxyStyler(bundledMail);
        this.quickSelectHandler = new QuickSelectHandler();
        // Defaults mirror OPTION_DEFAULTS / the options page; sync overlay follows.
        this.groupMessagesByDate = true;
        this.colorBundlesByLabel = true;
        this.bundleColorStyle = 'background';
        this.matchStylusCatppuccin = false;
        this.skipSingleItemBundles = true;
        this.keepStarredUnbundled = true;
        // Wait for this before the first bundle pass — otherwise the defaults
        // above win a race against chrome.storage.sync and starred messages
        // stay unbundled even when keepStarredUnbundled is stored as false.
        this.optionsReady = new Promise(resolve => {
            chrome.storage.sync.get(
                {
                    groupMessagesByDate: true,
                    colorBundlesByLabel: true,
                    bundleColorStyle: 'background',
                    matchStylusCatppuccin: false,
                    skipSingleItemBundles: true,
                    keepStarredUnbundled: true,
                },
                options => {
                    this.applyOptions(options);
                    resolve();
                });
        });
    }

    /**
     * Update bundling/display options from chrome.storage.sync (initial load or
     * a cross-device sync). Only keys present on `options` are applied.
     */
    applyOptions(options = {}) {
        if ('groupMessagesByDate' in options) {
            this.groupMessagesByDate = !!options.groupMessagesByDate;
        }
        if ('colorBundlesByLabel' in options) {
            this.colorBundlesByLabel = !!options.colorBundlesByLabel;
        }
        if ('bundleColorStyle' in options) {
            this.bundleColorStyle = options.bundleColorStyle === 'accent'
                ? 'accent'
                : 'background';
        }
        if ('matchStylusCatppuccin' in options) {
            this.matchStylusCatppuccin = !!options.matchStylusCatppuccin;
        }
        if ('skipSingleItemBundles' in options) {
            this.skipSingleItemBundles = !!options.skipSingleItemBundles;
        }
        if ('keepStarredUnbundled' in options) {
            this.keepStarredUnbundled = !!options.keepStarredUnbundled;
        }

        const html = document.querySelector('html');
        if (html) {
            html.classList.toggle(
                InboxyClasses.LABEL_COLOR_ACCENT,
                this.colorBundlesByLabel && this.bundleColorStyle === 'accent');
        }
    }

    /**
     * Bundle together the messages on the current page of messages, if they aren't already bundled,
     * optionally reopening the most recently open bundle.
     *
     * Returns an object with info for debug printing.
     */
    bundleMessages(reopenRecentBundle) {
        const bundledMail = this.bundledMail;
        const possibleMessageLists = document.querySelectorAll(Selectors.POSSIBLE_MESSAGE_LISTS);
        const messageList = possibleMessageLists.length 
            ? possibleMessageLists.item(possibleMessageLists.length - 1) 
            : null;

        if (!messageList) {
            return {
                foundMessageList: false,
            };
        }
        
        let debugInfo = { foundMessageList: true };

        this.messageListWatcher.disconnect();

        // Only redraw if message list isn't still bundled
        if (!messageList.children[0].classList.contains('is-bundled')) {
            debugInfo = this._bundleMessages(messageList);
            messageList.children[0].classList.add('is-bundled');
        }

        // Either reopen the bundle that was open, or close all bundles
        if (reopenRecentBundle && bundledMail.getBundle(bundledMail.getLabelOfOpenedBundle())) {
            this.bundleToggler.openBundle(bundledMail.getLabelOfOpenedBundle());
        }
        else {
            bundledMail.closeBundle();
        }

        this.messageListWatcher.observe();

        return debugInfo;
    }

    /**
     * Bundle messages in the given messageList dom node.
     *
     * Table rows are reordered by using flexbox and the order property, since Gmail's js seems 
     * to require the DOM nodes to remain in their original order. 
     *
     * Returns an object with info for debug printing.
     */
    _bundleMessages(messageList) {
        const tableBody = messageList.querySelector(Selectors.TABLE_BODY);

        document.querySelector('html').classList.add(InboxyClasses.INBOXY);
        tableBody.classList.add('flex-table-body');

        this._detectTheme();

        const messageNodes = [...tableBody.querySelectorAll(TableBodySelectors.MESSAGE_NODES)];

        const starredSample = messageNodes
            .filter(message => this._isStarred(message))
            .slice(0, 3)
            .map(message => ({
                keepStarredUnbundled: this.keepStarredUnbundled,
                skipSingleItemBundles: this.skipSingleItemBundles,
                labels: DomUtils.getLabelStrings(message),
                relevant: this.selectiveBundling.findRelevantLabels(message),
                forceUnbundled: !!this._shouldKeepUnbundled(message),
            }));
        if (starredSample.length) {
            console.log(`inboxy-debug: starred sample ${JSON.stringify(starredSample)}`);
        }

        const bundlesByLabel = this._groupByLabel(messageNodes);

        if (this.skipSingleItemBundles) {
            for (const label in bundlesByLabel) {
                // A custom bundle is explicit user intent, so keep it even with a
                // single message; only auto-derived (label) bundles are pruned.
                if (bundlesByLabel[label].getMessages().length === 1 &&
                    !isCustomBundleKey(label)) {
                    delete bundlesByLabel[label];
                }
            }
        }

        const sortedTableRows = this._calculateSortedTableRows(messageNodes, bundlesByLabel);
        
        const bundleRowsByLabel = this._drawTableRows(sortedTableRows, tableBody);
        this._drawBundleBox(tableBody);

        Object.entries(bundleRowsByLabel).forEach(([label, bundleRow]) => {
            const bundle = bundlesByLabel[label];
            bundle.setBundleRow(bundleRow);
            bundle.setOrder(parseInt(bundleRow.style.order));
        });

        this.bundledMail.setBundles(bundlesByLabel, getCurrentPageNumber());

        this._applyStyles(messageNodes);
        this._attachHandlers(messageNodes, messageList);

        return {
            numMessages: messageNodes.length,
            numBundles: Object.keys(bundlesByLabel).length,
        };
    }

    /**
     * Group messages by their labels.
     * Returns a map of labels to bundles.
     */
    _groupByLabel(messageNodes) {
        const bundlesByLabel = {};

        messageNodes.forEach(message => {
            const messageLabels = this.selectiveBundling.findRelevantLabels(message);

            if (!this._shouldKeepUnbundled(message)) {
                messageLabels.forEach(l => {
                    if (!bundlesByLabel[l]) {
                        const bundle = new Bundle(l);
                        bundlesByLabel[l] = bundle;
                    }

                    bundlesByLabel[l].addMessage(message);
                });
            }
        })

        return bundlesByLabel;
    }

    /**
     * Returns a list of elements that will be shown in the message list,
     * in the same order they will be displayed.
     * 
     * Each item is an object with 'element' and 'type' fields. They can be
     * a message row, date divider, or bundle row.
     */
    _calculateSortedTableRows(messageNodes, bundlesByLabel) {
        
        const rows = this._calculateMessageAndBundleRows(messageNodes, bundlesByLabel);

        if (!this.groupMessagesByDate) {
            return rows;
        }

        const sampleDate = messageNodes.length 
            ? DomUtils.extractDate(messageNodes[0])
            : '';

        return DateDivider.withDateDividers(rows, sampleDate, this._getLatestMessage);
    }

    _calculateMessageAndBundleRows(messageNodes, bundlesByLabel) {
        const rows = [];
        const labels = new Set();

        for (let i = 0; i < messageNodes.length; i++) {
            const message = messageNodes[i];
            const messageLabels = this.selectiveBundling.findRelevantLabels(message);

            // Labels whose bundle was pruned (e.g. single-item) fall through to unbundled.
            const bundlableLabels = messageLabels.filter(l => bundlesByLabel[l]);

            if (bundlableLabels.length === 0 || this._shouldKeepUnbundled(message)) {
                rows.push({
                    element: message,
                    type: Element.UNBUNDLED_MESSAGE,
                });
                continue;
            }

            bundlableLabels.forEach(l => {
                if (!labels.has(l)) {
                    rows.push({
                        element: bundlesByLabel[l],
                        type: Element.BUNDLE,
                    });
                    labels.add(l);
                }
            });
        }

        return rows;
    }

    /**
     * Return the most recent message associated with the given table row.
     */
    _getLatestMessage(tableRow) {
        if (!tableRow) {
            return null;
        }

        switch (tableRow.type) {
            case Element.BUNDLE:
                const bundle = tableRow.element;
                return bundle.getMessages()[0];
            case Element.UNBUNDLED_MESSAGE:
                return tableRow.element;
            default:
                throw `Unhandled element type: ${e.type}`;
        }   
    }

    /** 
     * Draw/append the table rows to the tableBody, and set their visual order.
     * 
     * Returns a map of newly created bundle rows by label.
     */
    _drawTableRows(tableRows, tableBody) {
        const baseUrl = getCurrentBaseUrl();
        const bundleRowsByLabel = {};
        tableRows.forEach((e, i) => {
            const order = (i + 1) * ORDER_INCREMENT;
            switch (e.type) {
                case Element.DATE_DIVIDER:
                    const messages = DateDivider.findMessagesForDivider(tableRows, i);
                    this._drawDateDivider(e.element, order, messages, tableBody);
                    break;
                case Element.BUNDLE:
                    const bundle = e.element;
                    const bundleRow = this._drawBundleRow(bundle, order, tableBody, baseUrl);
                    bundleRowsByLabel[bundle.getLabel()] = bundleRow;
                    break;
                case Element.UNBUNDLED_MESSAGE:
                    e.element.style.order = order;
                    break;
                default:
                    throw `Unhandled element type: ${e.type}`;
            }
        });

        return bundleRowsByLabel;
    }

    _drawBundleBox(tableBody) {
        const bundleBox = DomUtils.htmlToElement('<div class="bundle-area"></div>'); 
        bundleBox.addEventListener(
            'click', 
            () => this.bundleToggler.closeAllBundles());
        tableBody.appendChild(bundleBox);
    }

    /**
     * Create a date divider element and append it to the tableBody.
     */
    _drawDateDivider(divider, order, messages, tableBody) {
        const dividerNode = DateDivider.create(divider, order, messages);
        tableBody.append(dividerNode);
    }

    /**
     * Create a bundle row element and append it to the tableBody.
     */
    _drawBundleRow(bundle, order, tableBody, baseUrl) {
        const messages = bundle.getMessages();
        const hasUnreadMessages = messages.some(this._isUnreadMessage);
        const labelColors = this.colorBundlesByLabel
            ? this._findLabelColors(bundle.getLabel(), messages)
            : null;

        const bundleRow = BundleRow.create(
            bundle.getLabel(),
            order,
            messages,
            hasUnreadMessages,
            this.bundleToggler.toggleBundle,
            baseUrl,
            labelColors);
        tableBody.appendChild(bundleRow);

        messages.forEach(m => m.classList.add(InboxyClasses.BUNDLED_MESSAGE));

        return bundleRow;
    }

    /**
     * When the opt-in Catppuccin matching is enabled, detect the active flavor
     * of a Catppuccin userstyle (Stylus) from the injected <style class="stylus">
     * elements, so bundle colors can be snapped to its palette. Left null (no
     * matching) when the option is off or no Catppuccin theme is present.
     */
    _detectTheme() {
        const html = document.querySelector('html');
        if (!this.matchStylusCatppuccin) {
            this.themeFlavor = null;
            html.style.removeProperty('--inboxy-fill-base');
            return;
        }

        const themeCss = [...document.querySelectorAll('style.stylus')]
            .map(s => s.textContent)
            .join('\n');
        // Choose light vs dark flavor from Gmail's own theme, which drives the
        // visible appearance (more reliable than prefers-color-scheme, which can
        // disagree when Gmail is set light on a dark OS or vice versa).
        const isDark = html.classList.contains(InboxyClasses.MESSAGES_DARK_THEME);
        this.themeFlavor = detectThemeFlavor(themeCss, isDark);

        if (this.themeFlavor) {
            html.style.setProperty('--inboxy-fill-base', flavorBase(this.themeFlavor));
        }
        else {
            html.style.removeProperty('--inboxy-fill-base');
        }
    }

    /**
     * Find the Gmail label color for a bundle, by checking its messages until a
     * colored label chip is found. Returns { background, color, accent } or null.
     * With Catppuccin matching active, colors are snapped to the theme palette.
     */
    _findLabelColors(label, messages) {
        // For a combined-label bundle the key is several labels joined; color by
        // the first one. Single-label keys split to themselves (no separator).
        const firstLabel = label.split(LABEL_SET_SEPARATOR)[0];
        for (const message of messages) {
            const colors = DomUtils.getLabelColors(message, firstLabel);
            if (colors) {
                if (this.themeFlavor) {
                    // Snap Gmail's label color to the nearest theme accent so the
                    // bundle looks native to the userstyle's palette. Gray labels
                    // map to a neutral tone; flag them so the fill blends more
                    // strongly and doesn't disappear into the theme background.
                    colors.neutral = isNeutral(colors.background);
                    const accent = snapToAccent(colors.background, this.themeFlavor);
                    colors.background = accent;
                    colors.color = accent;
                    colors.accent = accent;
                }
                else {
                    const isDarkTheme = document.querySelector('html')
                        .classList.contains(InboxyClasses.MESSAGES_DARK_THEME);
                    colors.accent = DomUtils.pickAccentColor(colors, isDarkTheme);
                }
                return colors;
            }
        }
        return null;
    }

    _isUnreadMessage(message) {
        return message.classList.contains(GmailClasses.UNREAD);
    }

    _isStarred(message) {
        return message.querySelector(`.${GmailClasses.STARRED}`);
    }

    _shouldKeepUnbundled(message) {
        return this.keepStarredUnbundled && this._isStarred(message);
    }

    _applyStyles(messageNodes) {
        this.inboxyStyler.markSelectedBundles();
        this.inboxyStyler.disableBulkArchiveIfNecessary();
    }

    _attachHandlers(messageNodes, messageList) {
        // Ensure shift+click selection works
        document.querySelectorAll(Selectors.CHECKBOXES)
            .forEach(
                n => n.addEventListener('click', this.quickSelectHandler.handleCheckboxClick));

        // Close bundles when clicking outside of any open bundle
        messageList.addEventListener('click', e => {
            // #63 - e.target may have been removed before event propagates to messageList
            if (document.body.contains(e.target) && !e.target.closest('tr')) {
                this.bundleToggler.closeAllBundles();
            }
        });

        this.messageSelectHandler.startWatching(messageNodes);
    }
}

export default Bundler;