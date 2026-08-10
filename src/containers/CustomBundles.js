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

import { customBundleKey } from '../util/CustomBundleKey';

const STORAGE_KEY = 'customBundles';
const SCHEMA_VERSION = 1;

/**
 * The user-defined, ad-hoc bundles: named groupings of messages that have no
 * corresponding Gmail label. Membership is keyed by Gmail's stable thread id
 * and persisted to chrome.storage.sync, so a grouping is sticky across reloads
 * and rides Chrome's own sync to the user's other signed-in instances.
 *
 * A thread belongs to at most one custom bundle; adding it to another moves it.
 *
 * Persisted shape (versioned so a future label-backed sync mode can extend it
 * without a migration):
 *
 *     { v: 1, bundles: { "<name>": ["<threadId>", ...], ... } }
 */
class CustomBundles {
    constructor() {
        // name -> Set(threadId), and the inverse threadId -> name for O(1) lookup
        // during bundling.
        this._byName = new Map();
        this._nameByThread = new Map();
        this.ready = this._load();
    }

    _load() {
        const self = this;
        return new Promise(resolve => {
            chrome.storage.sync.get({ [STORAGE_KEY]: null }, result => {
                self._ingest(result[STORAGE_KEY]);
                resolve();
            });
        });
    }

    /**
     * Replace the in-memory state from a stored (or freshly changed) value.
     * Tolerant of a missing/legacy value: an absent bundle map yields no bundles.
     */
    _ingest(stored) {
        this._byName = new Map();
        this._nameByThread = new Map();

        const bundles = stored && stored.bundles ? stored.bundles : {};
        for (const [name, threadIds] of Object.entries(bundles)) {
            const set = new Set(threadIds);
            this._byName.set(name, set);
            for (const threadId of set) {
                this._nameByThread.set(threadId, name);
            }
        }
    }

    /**
     * Re-read state from a chrome.storage change value (the `newValue` handed to
     * a storage.onChanged listener), so a change made in another tab or synced
     * from another device is reflected here.
     */
    applyStoredValue(stored) {
        this._ingest(stored);
    }

    /**
     * The custom bundle key for the message's thread, or null if the thread is
     * not in any custom bundle. The key is prefixed so it flows through the
     * label-keyed bundling pipeline without colliding with a real label.
     */
    keyForThread(threadId) {
        if (threadId == null) {
            return null;
        }
        const name = this._nameByThread.get(threadId);
        return name === undefined ? null : customBundleKey(name);
    }

    /**
     * The names of all custom bundles.
     */
    names() {
        return [...this._byName.keys()];
    }

    /**
     * Add the given thread ids to the named bundle, creating it if necessary.
     * Each thread is first removed from any other custom bundle (a thread belongs
     * to one bundle). Persists and returns a promise that resolves when stored.
     */
    addToBundle(name, threadIds) {
        for (const threadId of threadIds) {
            this._detach(threadId);
        }

        let set = this._byName.get(name);
        if (!set) {
            set = new Set();
            this._byName.set(name, set);
        }
        for (const threadId of threadIds) {
            set.add(threadId);
            this._nameByThread.set(threadId, name);
        }

        return this._persist();
    }

    /**
     * Remove the given thread ids from whatever custom bundle they're in. A
     * bundle left with no members is deleted. Persists.
     */
    removeThreads(threadIds) {
        for (const threadId of threadIds) {
            this._detach(threadId);
        }
        return this._persist();
    }

    /**
     * Rename a custom bundle, preserving its membership. No-op if `from` doesn't
     * exist; if `to` already exists the two are merged.
     */
    renameBundle(from, to) {
        const set = this._byName.get(from);
        if (!set || from === to) {
            return Promise.resolve();
        }
        this._byName.delete(from);
        const target = this._byName.get(to) || new Set();
        for (const threadId of set) {
            target.add(threadId);
            this._nameByThread.set(threadId, to);
        }
        this._byName.set(to, target);
        return this._persist();
    }

    /**
     * Delete a custom bundle and all its membership.
     */
    deleteBundle(name) {
        const set = this._byName.get(name);
        if (!set) {
            return Promise.resolve();
        }
        for (const threadId of set) {
            this._nameByThread.delete(threadId);
        }
        this._byName.delete(name);
        return this._persist();
    }

    /**
     * Lazily drop thread ids that haven't been seen in the inbox for a while,
     * so bundles don't accumulate ids for threads that were deleted elsewhere.
     * `seenThreadIds` is the set of thread ids present in the current render;
     * an id absent from it is only pruned once it's gone unseen `maxMisses`
     * times in a row, so a thread that's merely on another page or archived-
     * then-restored isn't forgotten prematurely. Membership stays sticky
     * otherwise. Persists only if something was actually pruned.
     */
    pruneUnseen(seenThreadIds, maxMisses = 25) {
        if (!this._misses) {
            this._misses = new Map();
        }

        let changed = false;
        for (const [threadId, name] of [...this._nameByThread]) {
            if (seenThreadIds.has(threadId)) {
                this._misses.delete(threadId);
                continue;
            }
            const misses = (this._misses.get(threadId) || 0) + 1;
            if (misses >= maxMisses) {
                this._detach(threadId);
                this._misses.delete(threadId);
                changed = true;
            }
            else {
                this._misses.set(threadId, misses);
            }
        }

        return changed ? this._persist() : Promise.resolve();
    }

    _detach(threadId) {
        const name = this._nameByThread.get(threadId);
        if (name === undefined) {
            return;
        }
        this._nameByThread.delete(threadId);
        const set = this._byName.get(name);
        if (set) {
            set.delete(threadId);
            if (set.size === 0) {
                this._byName.delete(name);
            }
        }
    }

    _serialize() {
        const bundles = {};
        for (const [name, set] of this._byName) {
            bundles[name] = [...set];
        }
        return { v: SCHEMA_VERSION, bundles };
    }

    _persist() {
        return new Promise(resolve => {
            chrome.storage.sync.set({ [STORAGE_KEY]: this._serialize() }, resolve);
        });
    }
}

export { STORAGE_KEY, SCHEMA_VERSION };
export default CustomBundles;
