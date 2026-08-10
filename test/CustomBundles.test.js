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

import CustomBundles, { STORAGE_KEY } from '../src/containers/CustomBundles';
import { customBundleKey } from '../src/util/CustomBundleKey';

/**
 * An in-memory stand-in for chrome.storage.sync. get() and set() invoke their
 * callbacks synchronously, mirroring how the real API behaves closely enough for
 * these unit tests (and how the existing SelectiveBundling tests mock storage).
 */
function fakeStorage(initial = {}) {
    const store = { ...initial };
    return {
        store,
        sync: {
            get: (defaults, cb) => {
                const out = {};
                for (const key of Object.keys(defaults)) {
                    out[key] = key in store ? store[key] : defaults[key];
                }
                cb(out);
            },
            set: (items, cb) => {
                Object.assign(store, items);
                if (cb) cb();
            },
        },
    };
}

function makeCustomBundles(initial) {
    global.chrome = { storage: fakeStorage(initial) };
    return new CustomBundles();
}

test('a newly created bundle keys its threads and persists them', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('Trip', ['aaa', 'bbb']);

    expect(cb.keyForThread('aaa')).toBe(customBundleKey('Trip'));
    expect(cb.keyForThread('bbb')).toBe(customBundleKey('Trip'));
    expect(chrome.storage.store[STORAGE_KEY]).toEqual({
        v: 1,
        bundles: { Trip: ['aaa', 'bbb'] },
    });
});

test('a thread not in any bundle has no key', () => {
    const cb = makeCustomBundles();
    expect(cb.keyForThread('nope')).toBeNull();
    expect(cb.keyForThread(null)).toBeNull();
});

test('adding a thread to a second bundle moves it out of the first', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('A', ['x']);
    await cb.addToBundle('B', ['x']);

    expect(cb.keyForThread('x')).toBe(customBundleKey('B'));
    expect(cb.names().sort()).toEqual(['B']); // A emptied and dropped
});

test('removing the last thread deletes the bundle', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('A', ['x']);
    await cb.removeThreads(['x']);

    expect(cb.keyForThread('x')).toBeNull();
    expect(cb.names()).toEqual([]);
});

test('state is restored from previously stored value', () => {
    const cb = makeCustomBundles({
        [STORAGE_KEY]: { v: 1, bundles: { Saved: ['t1', 't2'] } },
    });
    expect(cb.keyForThread('t1')).toBe(customBundleKey('Saved'));
    expect(cb.names()).toEqual(['Saved']);
});

test('a missing/legacy stored value yields no bundles', () => {
    const cb = makeCustomBundles();
    expect(cb.names()).toEqual([]);
});

test('applyStoredValue reflects an external (synced) change', () => {
    const cb = makeCustomBundles();
    cb.applyStoredValue({ v: 1, bundles: { FromOtherDevice: ['z'] } });
    expect(cb.keyForThread('z')).toBe(customBundleKey('FromOtherDevice'));
});

test('renaming preserves membership', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('Old', ['a', 'b']);
    await cb.renameBundle('Old', 'New');

    expect(cb.names()).toEqual(['New']);
    expect(cb.keyForThread('a')).toBe(customBundleKey('New'));
});

test('deleting a bundle clears its membership', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('Gone', ['a']);
    await cb.deleteBundle('Gone');

    expect(cb.names()).toEqual([]);
    expect(cb.keyForThread('a')).toBeNull();
});

test('pruneUnseen keeps threads seen in the current render', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('A', ['seen', 'gone']);
    // 'seen' is present every render; 'gone' never is.
    for (let i = 0; i < 30; i++) {
        await cb.pruneUnseen(new Set(['seen']));
    }
    expect(cb.keyForThread('seen')).toBe(customBundleKey('A'));
});

test('pruneUnseen eventually drops a thread gone for many renders', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('A', ['seen', 'gone']);
    for (let i = 0; i < 30; i++) {
        await cb.pruneUnseen(new Set(['seen']));
    }
    expect(cb.keyForThread('gone')).toBeNull();
});

test('pruneUnseen does not drop a thread that reappears before the limit', async () => {
    const cb = makeCustomBundles();
    await cb.addToBundle('A', ['flaky']);
    for (let i = 0; i < 10; i++) {
        await cb.pruneUnseen(new Set()); // missed a few times...
    }
    await cb.pruneUnseen(new Set(['flaky'])); // ...then seen again, resetting
    for (let i = 0; i < 10; i++) {
        await cb.pruneUnseen(new Set());
    }
    expect(cb.keyForThread('flaky')).toBe(customBundleKey('A'));
});
