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

import BundleToggler from './bundling/BundleToggler';
import Bundler from './bundling/Bundler';
import DateGrouper from './bundling/DateGrouper';
import SelectiveBundling from './bundling/SelectiveBundling';

import BundledMail from './containers/BundledMail';
import CustomBundles, { STORAGE_KEY as CUSTOM_BUNDLES_KEY } from './containers/CustomBundles';

import PinnedToggle from './components/PinnedToggle';
import SelectionBundleControl from './components/SelectionBundleControl';

import TabPanelsObserver from './handlers/TabPanelsObserver';
import MessageListObserver from './handlers/MessageListObserver';
import MainParentObserver from './handlers/MainParentObserver';
import MessageListWatcher from './handlers/MessageListWatcher';
import StarHandler from './handlers/StarHandler';
import ThemeChangeHandler from './handlers/ThemeChangeHandler';

import { 
    InbundlyClasses,
    Selectors,
} from './util/Constants';
import { createCoalescedRetry } from './util/CoalescedRetry';
import { 
    supportsBundling,
    isStarredPage,
} from './util/MessagePageUtils';
import {
    BUNDLING_OPTION_KEYS,
    UI_OPTION_KEYS,
    changesInclude,
    optionsFromChanges,
} from './util/Options';

const DEBUG = true;
const logDebugMessage = message => {
    if (DEBUG) {
        console.log(`inbundly-debug: ${message}`);
    }
};

const html = document.querySelector('html');
if (html) {
    logDebugMessage('Applying styles');
    html.classList.add(InbundlyClasses.INBUNDLY);

    // The pinned-messages toggle and bulk-archive button are hidden by default;
    // opt in to them from the options page. Values sync across devices.
    chrome.storage.sync.get(
        { showPinnedToggle: false, showBundleArchive: false },
        options => applyUiOptions(options));
}

/**
 * Toggle injected UI chrome from showPinnedToggle / showBundleArchive options.
 */
function applyUiOptions({ showPinnedToggle, showBundleArchive } = {}) {
    const htmlEl = document.querySelector('html');
    if (!htmlEl) {
        return;
    }
    if (showPinnedToggle !== undefined) {
        htmlEl.classList.toggle(InbundlyClasses.HIDE_PINNED_TOGGLE, !showPinnedToggle);
    }
    if (showBundleArchive !== undefined) {
        htmlEl.classList.toggle(InbundlyClasses.HIDE_BUNDLE_ARCHIVE, !showBundleArchive);
    }
}

const RETRY_TIMEOUT_MS = 50;
// How long to poll for Gmail's role="main" before slowing down (~10s of fast polls).
const MAX_FAST_MAIN_ATTEMPTS = 200;
// Soft retries when the inbox URL is active but the message list isn't painted yet.
const MAX_BUNDLE_RETRIES = 100;

let observersStarted = false;
let isFreshPage = false;
const handleFreshPage = e => isFreshPage = true;

let interactedWithBundle = false;
const handleBundleInteraction = e => interactedWithBundle = true;

/**
 * Call bundler.bundleMessages; if the message list isn't in the DOM yet
 * (common when navigating back to Inbox before Gmail finishes painting),
 * schedule coalesced retries instead of giving up.
 */
function bundleOrRetry(reopenRecentBundle) {
    if (!supportsBundling(window.location.href)) {
        bundleRetry.reset();
        return { foundMessageList: true, skipped: true };
    }

    const debugInfo = bundler.bundleMessages(reopenRecentBundle);
    if (debugInfo.foundMessageList) {
        bundleRetry.reset();
        return debugInfo;
    }

    // Remember the reopen flag from the latest caller; retries use this.
    pendingReopenRecentBundle = reopenRecentBundle;
    // A new caller gets a fresh retry budget unless a wave is already in flight
    // (in which case we just coalesce onto that pending timer).
    if (!bundleRetry.pending) {
        bundleRetry.reset();
    }
    const scheduled = bundleRetry.schedule(MAX_BUNDLE_RETRIES);
    if (!scheduled) {
        logDebugMessage(
            'Message list still missing after retries; waiting for navigation observers');
    }
    return debugInfo;
}

const rebundle = () => {
    if (!interactedWithBundle || isFreshPage) {
        bundleToggler.closeAllBundles();
    }
    bundleOrRetry(true);

    isFreshPage = false;
    interactedWithBundle = false;
};
const handleGmailRerender = () => {
    if (supportsBundling(window.location.href)) {
        const reopenRecentBundle = !isFreshPage;
        bundleOrRetry(reopenRecentBundle);
        starHandler.scrollIfNecessary();
        
        isFreshPage = false;
    }
};

const messageListWatcher = new MessageListWatcher(handleGmailRerender);

const bundledMail = new BundledMail();
const bundleToggler = new BundleToggler(bundledMail);
const customBundles = new CustomBundles();
const selectiveBundling = new SelectiveBundling(customBundles);
const selectionBundleControl = new SelectionBundleControl(customBundles);
const bundler = new Bundler(bundleToggler, bundledMail, messageListWatcher, selectiveBundling);
const starHandler = new StarHandler(bundledMail, selectiveBundling);
const dateGrouper = new DateGrouper();

let pendingReopenRecentBundle = false;
const bundleRetry = createCoalescedRetry(() => {
    if (!supportsBundling(window.location.href)) {
        bundleRetry.reset();
        return;
    }
    const debugInfo = bundler.bundleMessages(pendingReopenRecentBundle);
    if (debugInfo.foundMessageList) {
        logDebugMessage(`Bundled after retry: ${JSON.stringify(debugInfo)}`);
        bundleRetry.reset();
        starHandler.scrollIfNecessary();
    }
    else if (!bundleRetry.schedule(MAX_BUNDLE_RETRIES)) {
        logDebugMessage(
            'Message list still missing after retries; waiting for navigation observers');
    }
}, RETRY_TIMEOUT_MS);

// 
// Observers for handling navigation, rerenders by Gmail, etc.
// 
const tabPanelsObserver = new TabPanelsObserver(mutations => rebundle());
const messageListObserver = new MessageListObserver(handleGmailRerender);
const mainParentObserver = new MainParentObserver(mutations => {
    if (supportsBundling(window.location.href)) {
        rebundle();
    }
    else if (isStarredPage(window.location.href)) {
        dateGrouper.refreshDateDividers();
    }
});

//
// Attach event listeners
//
// Call the bundler when the page has loaded.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleContentLoaded);
}
else {
    handleContentLoaded();
}

document.addEventListener('mousedown', starHandler.handleStarring);

// Record when interactions with navigation, refreshes, or bundles occur
document.addEventListener('mousedown', e => {
    if (e.target.matches(Selectors.INBOX_TAB) || 
        e.target.matches(`${Selectors.INBOX_TAB} *`) ||
        e.target.matches(Selectors.PAGECHANGING_BUTTONS) ||
        e.target.matches(`${Selectors.REFRESH} *`)) 
    {
        handleFreshPage(e);
    }
    else if (e.target.matches(`.${InbundlyClasses.VIEW_ALL_LINK}`) ||
        e.target.matches(`.${InbundlyClasses.VIEW_ALL_LINK} *`) || 
        e.target.matches(`.${InbundlyClasses.BUNDLED_MESSAGE}`) ||
        e.target.matches(`.${InbundlyClasses.BUNDLED_MESSAGE} *`)) 
    {
        handleBundleInteraction(e);
    }
});


// Apply option / custom-bundle changes from this browser or another device
// signed into the same Chrome / Firefox account (chrome.storage.sync).
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') {
        return;
    }

    let needsRefresh = false;

    if (changes[CUSTOM_BUNDLES_KEY]) {
        customBundles.applyStoredValue(changes[CUSTOM_BUNDLES_KEY].newValue);
        selectionBundleControl.update();
        needsRefresh = true;
    }

    if (changesInclude(changes, UI_OPTION_KEYS)) {
        applyUiOptions(optionsFromChanges(changes, UI_OPTION_KEYS));
    }

    if (changesInclude(changes, BUNDLING_OPTION_KEYS)) {
        const bundlingOptions = optionsFromChanges(changes, BUNDLING_OPTION_KEYS);
        selectiveBundling.applyOptions(bundlingOptions);
        bundler.applyOptions(bundlingOptions);
        starHandler.applyOptions(bundlingOptions);
        dateGrouper.applyOptions(bundlingOptions);
        needsRefresh = true;
    }

    if (needsRefresh) {
        if (supportsBundling(window.location.href)) {
            refreshInbox();
        }
        else if (isStarredPage(window.location.href) &&
            changesInclude(changes, ['groupMessagesByDate'])) {
            dateGrouper.refreshDateDividers();
        }
    }
});


//
// Initial bundling
//

function handleContentLoaded() {
    logDebugMessage('Handle content loaded event');
    logDebugMessage(
        `Url: ${window.location.href}, page supports bundling: ${supportsBundling(window.location.href)}`);
    // Constructors default options synchronously and overlay storage async.
    // Wait so the first bundle pass sees stored values (e.g. keepStarredUnbundled
    // false) instead of racing with chrome.storage.sync.get.
    Promise.all([
        bundler.optionsReady,
        selectiveBundling.optionsReady,
        starHandler.optionsReady,
        dateGrouper.optionsReady,
        customBundles.ready,
    ]).then(() => {
        logDebugMessage('Stored options ready; starting');
        tryStart(0);
    });
}

/**
 * Wait for Gmail's main UI, start navigation observers as soon as it exists,
 * then attempt to bundle. Never throws — a slow Inbox paint must not disable
 * the extension for the rest of the tab's life.
 */
function tryStart(i) {
    if (!ensureObserversStarted()) {
        if (i === MAX_FAST_MAIN_ATTEMPTS) {
            logDebugMessage(
                'Gmail main UI not ready yet; continuing to wait (observers not started)');
        }
        const delay = i < MAX_FAST_MAIN_ATTEMPTS ? RETRY_TIMEOUT_MS : 500;
        setTimeout(() => tryStart(i + 1), delay);
        return;
    }

    if (supportsBundling(window.location.href)) {
        logDebugMessage('Bundle messages');
        const debugInfo = bundleOrRetry(false);
        logDebugMessage(JSON.stringify(debugInfo));
    }
    else if (isStarredPage(window.location.href)) {
        dateGrouper.refreshDateDividers();
    }
}

/**
 * Attach observers once Gmail's role="main" is present. Returns false until then.
 * Starting observers independently of the message list means navigating back to
 * Inbox can still trigger rebundling even if the first bundle attempt was early.
 */
function ensureObserversStarted() {
    if (observersStarted) {
        return true;
    }
    const main = document.querySelector(Selectors.MAIN);
    if (!main) {
        return false;
    }
    logDebugMessage('Start observers');
    addPinnedToggle();
    startObservers();
    observersStarted = true;
    return true;
}

function startObservers() {
    const themeChangeHandler = new ThemeChangeHandler();
    themeChangeHandler.observe();
    mainParentObserver.observe();
    tabPanelsObserver.observe();
    messageListObserver.observe();
    selectionBundleControl.attach();
}

/**
 * Trigger Gmail's own inbox refresh, which rebuilds the message list and causes
 * inbundly to re-bundle. Used after custom-bundle membership or bundling-option
 * changes (including those synced from another device).
 */
function refreshInbox() {
    const refresh = document.querySelector(Selectors.REFRESH);
    if (!refresh) {
        return;
    }
    ['mouseover', 'mousedown', 'click', 'mouseup'].forEach(name => {
        refresh.dispatchEvent(
            new MouseEvent(name, { view: window, bubbles: true, cancelable: true }));
    });
}

function addPinnedToggle() {
    const searchForm = document.querySelector(Selectors.SEARCH_FORM);
    if (!searchForm || !searchForm.parentNode) {
        logDebugMessage('Search form not ready; skipping pinned toggle for now');
        return;
    }
    searchForm.parentNode.appendChild((new PinnedToggle()).create());
}
