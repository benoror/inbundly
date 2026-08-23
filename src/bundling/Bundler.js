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

import Bundle from '../containers/Bundle';

import BundleRow from '../components/BundleRow';
import DateDivider from '../components/DateDivider';

import QuickSelectHandler from '../handlers/QuickSelectHandler';
import MessageSelectHandler from '../handlers/MessageSelectHandler';

import InbundlyStyler from './InbundlyStyler';

import { 
    getCurrentPageNumber, 
    getCurrentBaseUrl,
} from '../util/MessagePageUtils';
import { 
    GmailClasses,
    InbundlyClasses,
    Selectors,
    TableBodySelectors,
    ORDER_INCREMENT,
    Element,
    LABEL_SET_SEPARATOR,
    SECTION_ATTR,
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
        this.inbundlyStyler = new InbundlyStyler(bundledMail);
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
                InbundlyClasses.LABEL_COLOR_ACCENT,
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
        const messageLists = DomUtils.getSectionMessageLists();

        if (!messageLists.length) {
            return {
                foundMessageList: false,
            };
        }

        this.messageListWatcher.disconnect();
        // Keep the selection observer attached across passes. It lives on a stable
        // role="main" ancestor and is idempotent, so re-attaching every pass (below)
        // is a no-op unless main was replaced. Disconnecting here instead — and only
        // re-attaching inside _bundleMessages — would leave it dead after any pass
        // that skips already-bundled sections (a common Gmail rerender).
        this.messageSelectHandler.startWatching();

        // More than one section means Gmail is already splitting the view by
        // importance/starred/query (each panel a heading of its own), so inbundly
        // must not add its own date-row dividers on top — the section headings
        // are the de-facto grouping. Date dividers stay only in the single-list
        // Default inbox, and only when the user hasn't turned them off.
        const multiSection = messageLists.length > 1;
        const groupByDate = this.groupMessagesByDate && !multiSection;

        let redrew = false;
        let numMessages = 0;
        let numBundles = 0;
        messageLists.forEach((messageList, sectionIndex) => {
            const sectionId = String(sectionIndex);
            // Only redraw if this section's list isn't still bundled.
            if (messageList.children[0].classList.contains('is-bundled')) {
                return;
            }
            const info = this._bundleMessages(
                messageList, sectionId, groupByDate, reopenRecentBundle);
            messageList.children[0].classList.add('is-bundled');
            redrew = true;
            numMessages += info.numMessages;
            numBundles += info.numBundles;
        });

        // Drop state for sections that no longer exist (inbox layout shrank).
        bundledMail.pruneSectionsFrom(messageLists.length);

        // Either reopen the bundle that was open, or close all bundles
        if (reopenRecentBundle && bundledMail.getOpenedBundle()) {
            const { sectionId, label, frozenOrder } = bundledMail.getOpenedBundleRef();
            // Pin the reopened bundle back to the position it had when the user
            // opened it, so it holds its slot instead of jumping to the order its
            // (now newest) message would give it after a rerender. Every other row
            // is renumbered on the 100-grid each pass, so pinning to the exact old
            // order would tie with the row that slid into that slot — and since
            // bundle rows are appended last in the DOM, the tie drops the bundle
            // below it. Offsetting half a grid step keeps it strictly between the
            // same two grid neighbours (frozenOrder-100 and frozenOrder), i.e. its
            // original slot. Its collapsed messages (order+1..+n) still fit in the
            // remaining half-step gap.
            if (frozenOrder != null) {
                const pinnedOrder = frozenOrder - Math.floor(ORDER_INCREMENT / 2);
                const bundle = bundledMail.getBundleInSection(sectionId, label);
                bundle.setOrder(pinnedOrder);
                bundle.getBundleRow().style.order = pinnedOrder;
            }
            this.bundleToggler.openBundle(sectionId, label);
        }
        else {
            bundledMail.closeBundle();
        }

        this.messageListWatcher.observe();

        return {
            foundMessageList: true,
            numSections: messageLists.length,
            numMessages,
            numBundles,
            redrew,
        };
    }

    /**
     * Bundle messages in the given messageList dom node.
     *
     * Table rows are reordered by using flexbox and the order property, since Gmail's js seems 
     * to require the DOM nodes to remain in their original order. 
     *
     * Returns an object with info for debug printing.
     */
    _bundleMessages(messageList, sectionId, groupByDate, reopenRecentBundle) {
        const tableBody = messageList.querySelector(Selectors.TABLE_BODY);

        document.querySelector('html').classList.add(InbundlyClasses.INBUNDLY);
        tableBody.classList.add('flex-table-body');
        // Stamp the section so a message row can be mapped back to its section.
        tableBody.setAttribute(SECTION_ATTR, sectionId);

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
            console.log(`inbundly-debug: starred sample ${JSON.stringify(starredSample)}`);
        }

        const bundlesByLabel = this._groupByLabel(messageNodes, sectionId);

        if (this.skipSingleItemBundles) {
            this._pruneSingleItemBundles(bundlesByLabel, sectionId, reopenRecentBundle);
        }

        const sortedTableRows =
            this._calculateSortedTableRows(messageNodes, bundlesByLabel, groupByDate);

        const bundleRowsByLabel = this._drawTableRows(sortedTableRows, tableBody, sectionId);
        this._drawBundleBox(tableBody);

        Object.entries(bundleRowsByLabel).forEach(([label, bundleRow]) => {
            const bundle = bundlesByLabel[label];
            bundle.setBundleRow(bundleRow);
            bundle.setOrder(parseInt(bundleRow.style.order));
        });

        this.bundledMail.setBundles(bundlesByLabel, getCurrentPageNumber(), sectionId);

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
    _groupByLabel(messageNodes, sectionId) {
        const bundlesByLabel = {};

        messageNodes.forEach(message => {
            const messageLabels = this.selectiveBundling.findRelevantLabels(message);

            if (!this._shouldKeepUnbundled(message)) {
                messageLabels.forEach(l => {
                    if (!bundlesByLabel[l]) {
                        const bundle = new Bundle(l, sectionId);
                        bundlesByLabel[l] = bundle;
                    }

                    bundlesByLabel[l].addMessage(message);
                });
            }
        })

        return bundlesByLabel;
    }

    /**
     * Drop single-message bundles from `bundlesByLabel` in place, with two
     * exemptions:
     *  - custom bundles (explicit user intent), and
     *  - the currently-open bundle in this section while a reopen is in effect,
     *    so acting on its threads (archive/delete/snooze) doesn't make it vanish
     *    mid-workflow — it survives at one message until emptied or collapsed.
     */
    _pruneSingleItemBundles(bundlesByLabel, sectionId, reopenRecentBundle) {
        const openRef = reopenRecentBundle
            ? this.bundledMail.getOpenedBundleRef()
            : null;
        for (const label in bundlesByLabel) {
            const isOpenBundle = openRef &&
                openRef.sectionId === sectionId &&
                openRef.label === label;
            if (bundlesByLabel[label].getMessages().length === 1 &&
                !isCustomBundleKey(label) &&
                !isOpenBundle) {
                delete bundlesByLabel[label];
            }
        }
    }

    /**
     * Returns a list of elements that will be shown in the message list,
     * in the same order they will be displayed.
     * 
     * Each item is an object with 'element' and 'type' fields. They can be
     * a message row, date divider, or bundle row.
     */
    _calculateSortedTableRows(messageNodes, bundlesByLabel, groupByDate) {

        const rows = this._calculateMessageAndBundleRows(messageNodes, bundlesByLabel);

        if (!groupByDate) {
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
    _drawTableRows(tableRows, tableBody, sectionId) {
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
                    const bundleRow =
                        this._drawBundleRow(bundle, order, tableBody, baseUrl, sectionId);
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
    _drawBundleRow(bundle, order, tableBody, baseUrl, sectionId) {
        const messages = bundle.getMessages();
        const hasUnreadMessages = messages.some(this._isUnreadMessage);
        const labelColors = this.colorBundlesByLabel
            ? this._findLabelColors(bundle.getLabel(), messages)
            : null;

        // The row only knows its own label; bind the section so toggling opens
        // the right section's bundle when the same label exists in several.
        const toggleBundle = label => this.bundleToggler.toggleBundle(sectionId, label);

        const bundleRow = BundleRow.create(
            bundle.getLabel(),
            order,
            messages,
            hasUnreadMessages,
            toggleBundle,
            baseUrl,
            labelColors);
        tableBody.appendChild(bundleRow);

        messages.forEach(m => m.classList.add(InbundlyClasses.BUNDLED_MESSAGE));

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
            html.style.removeProperty('--inbundly-fill-base');
            return;
        }

        const themeCss = [...document.querySelectorAll('style.stylus')]
            .map(s => s.textContent)
            .join('\n');
        // Choose light vs dark flavor from Gmail's own theme, which drives the
        // visible appearance (more reliable than prefers-color-scheme, which can
        // disagree when Gmail is set light on a dark OS or vice versa).
        const isDark = html.classList.contains(InbundlyClasses.MESSAGES_DARK_THEME);
        this.themeFlavor = detectThemeFlavor(themeCss, isDark);

        if (this.themeFlavor) {
            html.style.setProperty('--inbundly-fill-base', flavorBase(this.themeFlavor));
        }
        else {
            html.style.removeProperty('--inbundly-fill-base');
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
                        .classList.contains(InbundlyClasses.MESSAGES_DARK_THEME);
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
        this.inbundlyStyler.markSelectedBundles();
        this.inbundlyStyler.disableBulkArchiveIfNecessary();
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
        // The selection observer is attached once per pass in bundleMessages
        // (on role="main"), independent of whether this section was redrawn.
    }
}

export default Bundler;