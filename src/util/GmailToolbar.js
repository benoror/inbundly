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

/**
 * Select the given messages, then click the toolbar button matched by
 * `toolbarButtonSelector` once it is clickable. No-op when no such button
 * exists (e.g. Gmail changed its markup).
 */
function triggerToolbarAction(toolbarButtonSelector, selectMessagesFunction) {
    const toolbarButton = document.querySelector(toolbarButtonSelector);
    if (!toolbarButton || !toolbarButton.parentNode) {
        return;
    }

    const buttonIsVisible = new Promise(resolve => {
        const observer = new MutationObserver((mutation, observer) => {
            if (_isClickable(toolbarButton)) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(
            toolbarButton.parentNode,
            { attributes: true, childList: false, subtree: true });
    });

    const selectMessages = new Promise(resolve => {
        selectMessagesFunction();
        resolve();
    });

    Promise.all([buttonIsVisible, selectMessages]).then(() => _simulateClick(toolbarButton));
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

function _isClickable(button) {
    return getComputedStyle(button.parentNode).display !== 'none' &&
        button.getAttribute('aria-disabled') !== 'true';
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

export default { triggerToolbarAction, selectMessages };
