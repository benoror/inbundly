// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import BundleSnoozeButton from '../src/components/BundleSnoozeButton';
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

function makeSnoozeToolbar() {
    // Gmail hides the action buttons' direct parent while nothing is
    // selected; the .G-atb bar itself carries no inline display.
    document.body.innerHTML = `
        <div class="G-atb">
            <div class="G-Ni" style="display: none;">
                <div class="T-I J-J5-Ji" data-tooltip="Snooze" role="button"></div>
            </div>
        </div>
    `;
    return document.querySelector('[data-tooltip="Snooze"]');
}

describe('BundleSnoozeButton', () => {
    test('click selects the bundle messages and clicks the toolbar snooze', async () => {
        const toolbarSnooze = makeSnoozeToolbar();
        const toolbarClicks = jest.fn();
        toolbarSnooze.addEventListener('click', toolbarClicks);
        const messages = [makeMessage(false), makeMessage(true)];
        const button = BundleSnoozeButton.create(messages);

        button.click();

        expect(checkedStates(messages)).toEqual(['true', 'true']);

        // Gmail reveals the toolbar in response to the selection.
        toolbarSnooze.parentNode.style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(toolbarClicks).toHaveBeenCalled();
    });

    test('a disabled button does nothing', () => {
        makeSnoozeToolbar();
        const messages = [makeMessage(false)];
        const button = BundleSnoozeButton.create(messages);
        button.classList.add('disabled');

        button.click();

        expect(checkedStates(messages)).toEqual(['false']);
    });

    test('click does not bubble to the bundle row', () => {
        makeSnoozeToolbar();
        const messages = [makeMessage(false)];
        const button = BundleSnoozeButton.create(messages);
        const row = document.createElement('tr');
        row.appendChild(button);
        const rowListener = jest.fn();
        row.addEventListener('click', rowListener);

        button.click();

        expect(rowListener).not.toHaveBeenCalled();
    });

    test('the toolbar selector skips a stale toolbar hidden inline', () => {
        makeSnoozeToolbar();
        expect(document.querySelector(Selectors.TOOLBAR_SNOOZE_BUTTON)).not.toBeNull();

        // Gmail hides inactive toolbar copies with an inline display:none.
        document.querySelector('.G-atb').style.display = 'none';
        expect(document.querySelector(Selectors.TOOLBAR_SNOOZE_BUTTON)).toBeNull();
    });
});
