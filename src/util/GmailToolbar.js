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

import DomUtils from './DomUtils';
import { Selectors } from './Constants';

// Drive a bulk action through Gmail's own toolbar: select messages with
// Gmail's real per-row checkboxes (so Gmail's selection model updates and
// reveals the toolbar), wait for the target toolbar button to become
// clickable, then click it. Gmail handles the rest — including any menu the
// button opens (e.g. snooze times).

// How long to wait for Gmail to reveal the toolbar (or apply a precededBy
// step) before giving up. A wait that never ends would leave the selection in
// place and a MutationObserver attached for the life of the tab.
const REVEAL_TIMEOUT_MS = 3000;
const PRECEDED_BY_TIMEOUT_MS = 1500;

// The action in flight. A newer call supersedes it, so a wait that outlived
// its click can never fire on a selection the user made afterwards.
let pendingToken = 0;
let pendingPromise = null;

/**
 * Select the given messages, then click the toolbar button matched by
 * `toolbarButtonSelector` once it is clickable. No-op when no such button
 * exists (e.g. Gmail changed its markup).
 *
 * The button is looked up again at click time, preferring a copy that is
 * actually shown: Gmail may redraw the toolbar, and a toolbar Gmail keeps for
 * another view can sit hidden by an ancestor. When the toolbar is already
 * revealed (a thread was checked by hand first) Gmail writes nothing more as
 * the selection grows, so clickability is checked right after selecting too,
 * not only on a toolbar mutation.
 *
 * `precededBy` names another toolbar button to click first, on the same
 * selection, when it is present and clickable at that moment (e.g. "Mark as
 * read" ahead of Archive). It is looked up only once the toolbar has been
 * revealed, since Gmail sets those buttons up for the selection; when Gmail
 * shows no such button, the main action runs alone. After that first click
 * the main action waits until Gmail has applied it (the button stops being
 * clickable, e.g. the envelope flips to "Mark as unread"), or a short
 * timeout, then re-applies the selection and clicks.
 *
 * Returns a promise for whether the main action was clicked.
 */
function triggerToolbarAction(
    toolbarButtonSelector,
    selectMessagesFunction,
    { precededBy = null } = {})
{
    const toolbarButton = _findButton(toolbarButtonSelector);
    if (!toolbarButton || !toolbarButton.parentNode) {
        return Promise.resolve(false);
    }

    const token = ++pendingToken;
    const current = () => token === pendingToken;
    const clickable = () => current() && _findClickable(toolbarButtonSelector);
    const buttonIsVisible = _waitFor(clickable, toolbarButton.parentNode, REVEAL_TIMEOUT_MS, current);

    selectMessagesFunction();

    const promise = buttonIsVisible.then(button => {
        if (!button || !current()) {
            return false;
        }
        const firstButton = precededBy ? _findClickable(precededBy) : null;
        if (!firstButton) {
            _simulateClick(button);
            return true;
        }
        _simulateClick(firstButton);
        // Gmail may redraw the toolbar for the first action (the envelope
        // flips to "Mark as unread") and applies it asynchronously, so the main
        // action waits for that, then goes to the freshest copy of its button
        // on the same selection.
        return _waitFor(
            () => !current() || !_findClickable(precededBy),
            firstButton.parentNode,
            PRECEDED_BY_TIMEOUT_MS,
            current)
        .then(() => {
            selectMessagesFunction();
            return _waitFor(clickable, toolbarButton.parentNode, REVEAL_TIMEOUT_MS, current);
        })
        .then(fresh => {
            if (!current()) {
                return false;
            }
            _simulateClick(fresh || button);
            return true;
        });
    });
    pendingPromise = promise;
    promise.then(() => {
        if (current()) {
            pendingPromise = null;
        }
    });
    return promise;
}

/**
 * True while a toolbar action is waiting to click (selection made, Gmail not
 * driven yet). Handlers that would rebundle on the rows' changes (e.g. a star
 * flipped by unstarOnArchive) hold off meanwhile.
 */
function isBusy() {
    return !!pendingPromise;
}

/**
 * Settles once the action in flight (if any) has clicked or given up.
 */
function whenIdle() {
    return pendingPromise ? pendingPromise.then(() => undefined) : Promise.resolve();
}

/**
 * Drop the action in flight without clicking (tests, teardown).
 */
function cancelPending() {
    pendingToken++;
    pendingPromise = null;
}

/**
 * Resolve with `check()`'s first truthy value: checked on the next task (so
 * Gmail has handled the clicks that preceded the wait), on every attribute or
 * child change under `root`, and on a light poll as a backstop (Gmail may
 * re-render the toolbar outside `root`). Resolves with null on timeout, or
 * as soon as `isAlive()` turns false (the action was superseded).
 */
function _waitFor(check, root, timeoutMs, isAlive = () => true) {
    return new Promise(resolve => {
        let done = false;
        let observer = null;
        let poll = null;
        let timeout = null;
        const finish = value => {
            if (done) {
                return;
            }
            done = true;
            if (observer) {
                observer.disconnect();
            }
            clearInterval(poll);
            clearTimeout(timeout);
            resolve(value);
        };
        const tryCheck = () => {
            if (!isAlive()) {
                finish(null);
                return;
            }
            const value = check();
            if (value) {
                finish(value);
            }
        };
        if (root && root.isConnected !== false) {
            observer = new MutationObserver(tryCheck);
            observer.observe(root, { attributes: true, childList: true, subtree: true });
        }
        setTimeout(tryCheck, 0);
        poll = setInterval(tryCheck, 100);
        timeout = setTimeout(() => finish(null), timeoutMs);
    });
}

/**
 * The first button matching `selector`, preferring one that is shown (no
 * display:none on it or an ancestor).
 */
function _findButton(selector) {
    const buttons = [...document.querySelectorAll(selector)];
    return buttons.find(_isShown) || buttons[0] || null;
}

/**
 * The shown, enabled button matching `selector`, or null.
 */
function _findClickable(selector) {
    return [...document.querySelectorAll(selector)].find(_isClickable) || null;
}

/**
 * Select all given messages via Gmail's own row checkboxes.
 */
function selectMessages(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const checkboxNode = messages[i].querySelector(Selectors.MESSAGE_CHECKBOX);
        if (!DomUtils.isChecked(checkboxNode)) {
            checkboxNode.click();
        }
    }
}

/**
 * Deselect the given messages (those currently checked) via Gmail's own row
 * checkboxes, so a following toolbar action leaves them out.
 */
function deselectMessages(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const checkboxNode = messages[i].querySelector(Selectors.MESSAGE_CHECKBOX);
        if (DomUtils.isChecked(checkboxNode)) {
            checkboxNode.click();
        }
    }
}

function _isClickable(button) {
    return _isShown(button) &&
        button.getAttribute('aria-disabled') !== 'true';
}

/**
 * True when neither `element` nor any ancestor is display:none. Computed
 * style, not layout, so it holds under jsdom too.
 */
function _isShown(element) {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
        if (getComputedStyle(node).display === 'none') {
            return false;
        }
    }
    return !!element && element.isConnected !== false;
}

function _simulateClick(element) {
    const dispatchMouseEvent = function(target, name) {
        const e = new MouseEvent(name, {
            view: window,
            bubbles: true,
            cancelable: true,
          });
        target.dispatchEvent(e);
    };
    dispatchMouseEvent(element, 'mouseover');
    dispatchMouseEvent(element, 'mousedown');
    dispatchMouseEvent(element, 'click');
    dispatchMouseEvent(element, 'mouseup');
}

export default {
    triggerToolbarAction,
    selectMessages,
    deselectMessages,
    isBusy,
    whenIdle,
    cancelPending,
};
