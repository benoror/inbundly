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

import { getCurrentPageNumber, getCurrentTab } from './MessagePageUtils';

// Remembers the bundle the user last opened, so a rerender, navigation, or a
// tab reload can restore it. Backed by sessionStorage (per tab, survives
// reloads, dies with the browser session) — synchronous, needs no permission,
// and can't race the first bundle pass the way an async storage read could.
//
// Written only on explicit user intent (open/close clicks) — never from
// render paths — so transient state like StarHandler's scroll-anchoring
// openBundle() never leaks into it. The record is keyed by page + tab because
// the in-memory open-bundle ref is not: a bare (sectionId, label) could match
// a same-named bundle on another page.
const STORAGE_KEY = 'inbundly:openBundle:v1';

/**
 * Remember the bundle the user opened on the current page/tab.
 */
function save(sectionId, label) {
    _try(() => window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        page: getCurrentPageNumber(),
        tab: getCurrentTab(),
        sectionId,
        label,
    })));
}

/**
 * The remembered open bundle for the current page/tab, as
 * { sectionId, label }, or null when there is none.
 */
function load() {
    return _try(() => {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const stored = JSON.parse(raw);
        if (!stored ||
            typeof stored.label !== 'string' ||
            typeof stored.sectionId !== 'string' ||
            stored.page !== getCurrentPageNumber() ||
            stored.tab !== getCurrentTab())
        {
            return null;
        }
        return { sectionId: stored.sectionId, label: stored.label };
    });
}

/**
 * Forget the remembered open bundle (the user closed it).
 */
function clear() {
    _try(() => window.sessionStorage.removeItem(STORAGE_KEY));
}

// sessionStorage can throw (storage disabled, quota, private windows) — an
// unremembered bundle is always an acceptable fallback.
function _try(fn) {
    try {
        return fn();
    }
    catch (e) {
        return null;
    }
}

export default { save, load, clear };
