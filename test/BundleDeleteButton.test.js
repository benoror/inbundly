// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import BundleDeleteButton from '../src/components/BundleDeleteButton';
import { Selectors } from '../src/util/Constants';

/**
 * A minimal Gmail-like message row: a <tr> holding a checkbox node that
 * toggles its own aria-checked on click, like Gmail's does.
 */
function makeMessage(checked) {
    const tr = document.createElement('tr');
    const box = document.createElement('div');
    box.className = 'oZ-jc T-Jo J-J5-Ji';
    box.setAttribute('aria-checked', checked ? 'true' : 'false');
    box.addEventListener('click', () => {
        const next = box.getAttribute('aria-checked') === 'true' ? 'false' : 'true';
        box.setAttribute('aria-checked', next);
    });
    tr.appendChild(box);
    return tr;
}

function checkedStates(messages) {
    return messages.map(
        m => m.querySelector('.oZ-jc').getAttribute('aria-checked'));
}

function makeDeleteToolbar() {
    // Gmail hides the action buttons' direct parent while nothing is
    // selected; the .G-atb bar itself carries no inline display.
    document.body.innerHTML = `
        <div class="G-atb">
            <div class="G-Ni" style="display: none;">
                <div class="T-I J-J5-Ji" act="10" data-tooltip="Delete"
                    aria-label="Delete" role="button"></div>
            </div>
        </div>
    `;
    return document.querySelector('[act="10"]');
}

describe('BundleDeleteButton', () => {
    test('click selects the bundle messages and clicks the toolbar delete', async () => {
        const toolbarDelete = makeDeleteToolbar();
        const toolbarClicks = jest.fn();
        toolbarDelete.addEventListener('click', toolbarClicks);
        const messages = [makeMessage(false), makeMessage(true)];
        const button = BundleDeleteButton.create(messages);

        button.click();

        expect(checkedStates(messages)).toEqual(['true', 'true']);

        // Gmail reveals the toolbar in response to the selection.
        toolbarDelete.parentNode.style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(toolbarClicks).toHaveBeenCalled();
    });

    test('a disabled button does nothing', () => {
        makeDeleteToolbar();
        const messages = [makeMessage(false)];
        const button = BundleDeleteButton.create(messages);
        button.classList.add('disabled');

        button.click();

        expect(checkedStates(messages)).toEqual(['false']);
    });

    test('click does not bubble to the bundle row', () => {
        makeDeleteToolbar();
        const messages = [makeMessage(false)];
        const button = BundleDeleteButton.create(messages);
        const row = document.createElement('tr');
        row.appendChild(button);
        const rowListener = jest.fn();
        row.addEventListener('click', rowListener);

        button.click();

        expect(rowListener).not.toHaveBeenCalled();
    });

    test('the toolbar selector skips a stale toolbar hidden inline', () => {
        makeDeleteToolbar();
        expect(document.querySelector(Selectors.TOOLBAR_DELETE_BUTTON)).not.toBeNull();

        // Gmail hides inactive toolbar copies with an inline display:none.
        document.querySelector('.G-atb').style.display = 'none';
        expect(document.querySelector(Selectors.TOOLBAR_DELETE_BUTTON)).toBeNull();
    });
});
