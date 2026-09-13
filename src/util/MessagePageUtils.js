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
    Selectors,
    NO_TAB,
    Urls,
} from './Constants';
import { senderIdForEmail } from './SenderBundleKey';

// Gmail list views, by the first segment of the URL hash. The Inbox always
// bundles; the others only when the bundleOtherViews option is on. Anything
// else (a conversation, Sent, Drafts, Spam, Trash, settings, contacts) never
// bundles: Sent and Drafts rows show recipients where senders would be, and
// Spam/Trash are not places to curate. `arg` says whether the view carries an
// argument segment (a search query, a label or category name).
const VIEW_KINDS = {
    inbox: { arg: false, other: false },
    search: { arg: true, other: true },
    section_query: { arg: true, other: true },
    label: { arg: true, other: true },
    category: { arg: true, other: true },
    snoozed: { arg: false, other: true },
    starred: { arg: false, other: true },
    imp: { arg: false, other: true },
    all: { arg: false, other: true },
};

// The query that scopes a view's "View all" search to the same threads the
// view shows (Gmail search syntax, URL-encoded as Gmail writes it in the hash).
// Views with an argument build theirs from it; `all` needs no restriction.
const VIEW_SEARCH_SCOPES = {
    inbox: 'label%3AInbox',
    snoozed: 'in%3Asnoozed',
    starred: 'is%3Astarred',
    imp: 'is%3Aimportant',
    all: '',
};

// Whether the non-Inbox list views bundle (Options: bundleOtherViews). Read
// from chrome.storage.sync by content.js before the first bundle pass, and
// updated on live sync; mirrors OPTION_DEFAULTS in util/Options.js.
let bundleOtherViews = false;

/**
 * Update the view gate from chrome.storage.sync values (initial load or a
 * cross-device sync). Only keys present on `options` are applied.
 */
function applyOptions(options = {}) {
    if ('bundleOtherViews' in options) {
        bundleOtherViews = !!options.bundleOtherViews;
    }
}

/**
 * Parse a Gmail URL into the list view it shows:
 *   { kind, arg, page, key }
 * `kind` is a VIEW_KINDS name or null when the URL is not a list view we know
 * (a conversation, settings, ...). `arg` is the raw (still URL-encoded) query
 * or label segment, or null. `page` is the 1-based message page. `key` is the
 * hash without paging, e.g. 'inbox', 'search/label%3AWork', 'snoozed'.
 * A URL with no hash is the Inbox (Gmail's landing page).
 */
function parseView(url) {
    const hash = _getHash(url);
    const pageMatch = hash.match(/\/p(\d+)$/);
    const page = pageMatch ? parseInt(pageMatch[1]) : 1;
    const key = pageMatch ? hash.slice(0, pageMatch.index) : hash;
    const slash = key.indexOf('/');
    const kindName = slash >= 0 ? key.slice(0, slash) : key;
    const arg = slash >= 0 ? key.slice(slash + 1) : null;
    const kind = VIEW_KINDS[kindName];

    // A conversation adds a thread id segment (`#inbox/FMfcgz...`,
    // `#label/Work/FMfcgz...`); an argument view has exactly one argument
    // segment, an argument-less view none. Anything else is not a list.
    const isList = kind &&
        (kind.arg ? (arg !== null && arg.length > 0 && !arg.includes('/')) : arg === null);

    return {
        kind: isList ? kindName : null,
        arg: isList ? arg : null,
        page,
        key,
    };
}

/**
 * Get the message page number of the given url, or undefined when the url is
 * not a list view (e.g. a conversation).
 */
function getPageNumber(url) {
    const view = parseView(url);
    return view.kind ? view.page : undefined;
};

/**
 * Get the message page number of the current url.
 */
function getCurrentPageNumber() {
    return getPageNumber(window.location.href);
};

/**
 * The key of the list view the url shows, without paging: 'inbox',
 * 'search/<query>', 'label/<name>', 'snoozed', ... Pages of one view share a
 * key; two searches never do. Bundles and the remembered open bundle are kept
 * per view key (then page and tab).
 */
function getViewKey(url) {
    return parseView(url).key;
}

/**
 * The view key of the current url.
 */
function getCurrentViewKey() {
    return getViewKey(window.location.href);
}

/**
 * Get the name of the current tab.
 */
function getCurrentTab() {
    const tab = document.querySelector(Selectors.CURRENT_TAB);
    return tab ? tab.getAttribute('aria-label') : NO_TAB; 
}

/**
 * Whether the url is a page of the Inbox itself (the Default inbox or one of
 * the sectioned inbox types), where inbundly always bundles.
 */
function isInboxView(url) {
    return parseView(url).kind === 'inbox';
}

/**
 * Whether the url is one of the non-Inbox list views inbundly can bundle when
 * the bundleOtherViews option is on: search results (including a Multiple
 * Inboxes section's "View all"), a label or category view, Snoozed, Starred,
 * Important, or All Mail. The pinned page (starred messages in the inbox,
 * reached from the pinned toggle) is a search but stays a flat, date-grouped
 * list, so it is excluded here.
 */
function isOtherBundlableView(url) {
    const kind = parseView(url).kind;
    return !!kind && VIEW_KINDS[kind].other && !isStarredPage(url);
}

/**
 * Whether messages should be bundled on the page.
 */
function supportsBundling(url) {
    return isInboxView(url) || (bundleOtherViews && isOtherBundlableView(url));
}

/**
 * Whether the given url is for showing all starred (pinned) messages that are
 * in the inbox.
 */
function isStarredPage(url) {
    return url.includes('#') &&
        (_matchesStarredPage1(_getHash(url)) || !!_matchesStarredPageX(_getHash(url)));
}

/**
 * Normalize a label name the way Gmail's `label:` search operator does, so a
 * chip's name can be compared with the label a search or label view names:
 * case-insensitive, with spaces (and the `&` inbundly's own View all links
 * rewrite) folded to hyphens.
 */
function labelSearchKey(name) {
    return String(name).trim().toLowerCase().replace(/[\s&-]+/g, '-');
}

/**
 * The Gmail search term for a label, encoded as Gmail writes it in the hash:
 * spaces and `&` become hyphens (Gmail's label: syntax), nested separators
 * are percent-encoded.
 */
function labelSearchTerm(label) {
    return 'label%3A' + label
        .split(' ').join('-')
        .split('/').join('%2F')
        .split('&').join('-');
}

/**
 * The labels and senders a list view is already filtered by, so they are not
 * used as bundle keys there (a label view of Work is, by definition, all
 * Work; bundling it under Work again would collapse the whole list into one
 * row). Returns { labels, senders } where `labels` holds labelSearchKey()s
 * and `senders` sender ids (see SenderBundleKey), read from:
 *   - the label of a `#label/<name>` view;
 *   - the `label:` and `from:` terms of a `#search/<query>` or
 *     `#section_query/<query>` view (negated `-label:` terms are ignored).
 * Best effort on Gmail's search syntax: grouping parentheses and quotes are
 * stripped, `OR` groups contribute their first term only.
 */
function getViewFilters(url) {
    const filters = { labels: [], senders: [] };
    const view = parseView(url);
    if (!view.kind || !view.arg) {
        return filters;
    }

    if (view.kind === 'label') {
        filters.labels.push(labelSearchKey(_decode(view.arg)));
        return filters;
    }

    if (view.kind !== 'search' && view.kind !== 'section_query') {
        return filters;
    }

    _decode(view.arg)
        .replace(/[()"]/g, '')
        .split(/\s+/)
        .forEach(term => {
            const match = term.match(/^(label|from):(.+)$/i);
            if (!match) {
                return;
            }
            const value = match[2];
            if (match[1].toLowerCase() === 'label') {
                filters.labels.push(labelSearchKey(value));
                return;
            }
            // from:@domain names a domain; from:user@domain an address. A bare
            // name (from:joe) is not an address and cannot match a sender id.
            const senderId = value.startsWith('@')
                ? value.slice(1).toLowerCase()
                : senderIdForEmail(value);
            if (senderId) {
                filters.senders.push(senderId);
            }
        });
    return filters;
}

let cachedFiltersUrl = null;
let cachedFilters = null;

/**
 * getViewFilters for the current url, memoized on the url (it runs once per
 * message row per bundle pass).
 */
function getCurrentViewFilters() {
    const url = window.location.href;
    if (url !== cachedFiltersUrl) {
        cachedFiltersUrl = url;
        cachedFilters = getViewFilters(url);
    }
    return cachedFilters;
}

/**
 * The URL-encoded Gmail search that scopes a bundle's "View all" link to the
 * threads the current view shows, to be joined with the bundle's own label
 * or sender term: `label%3AInbox` in the Inbox, the view's own query on a
 * search page, `label%3A<name>` in a label view, `in%3Asnoozed` in Snoozed,
 * and so on. Empty when the view needs no restriction (All Mail) or is not a
 * list view we know.
 */
function getViewSearchScope(url) {
    const view = parseView(url);
    switch (view.kind) {
        case 'search':
        case 'section_query':
            return view.arg;
        case 'label':
            return labelSearchTerm(_decode(view.arg));
        case 'category':
            return 'category%3A' + view.arg;
        case null:
            return '';
        default:
            return VIEW_SEARCH_SCOPES[view.kind];
    }
}

/**
 * getViewSearchScope for the current url.
 */
function getCurrentViewSearchScope() {
    return getViewSearchScope(window.location.href);
}

/**
 * Returns the part of the current url that precedes '#'.
 */
function getCurrentBaseUrl() {
    const url = window.location.href;
    const parts = url.split('#');
    return parts[0];
}

function _getHash(url) {
    // No hash is Gmail's landing page, the Inbox.
    const hash = url.split('#')[1] || 'inbox';
    // # might be followed by ?
    const index = hash.indexOf('?');

    return index > 0 ? hash.substring(0, index) : hash;
}

/**
 * Decode a hash segment as Gmail encodes it: percent-escapes, with `+`
 * standing for a space in search queries.
 */
function _decode(segment) {
    try {
        return decodeURIComponent(segment.replace(/\+/g, ' '));
    }
    catch (e) {
        return segment;
    }
}

function _matchesStarredPage1(hash) {
    return hash === Urls.STARRED_PAGE_HASH;
}

function _matchesStarredPageX(hash) {
    return hash.match(/^search\/is%3Astarred\+label%3Ainbox\/p(\d+)$/)
}

export {
    applyOptions,
    parseView,
    getCurrentPageNumber, 
    getPageNumber,
    getViewKey,
    getCurrentViewKey,
    getCurrentTab,
    isInboxView,
    isOtherBundlableView,
    supportsBundling,
    isStarredPage,
    labelSearchKey,
    labelSearchTerm,
    getViewFilters,
    getCurrentViewFilters,
    getViewSearchScope,
    getCurrentViewSearchScope,
    getCurrentBaseUrl,
};