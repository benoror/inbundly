// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import GmailToolbar from '../src/util/GmailToolbar';
import { GmailClasses } from '../src/util/Constants';

function makeMessage(checked) {
    const message = document.createElement('tr');
    const checkbox = document.createElement('div');
    checkbox.className = GmailClasses.CHECKBOX;
    checkbox.setAttribute('aria-checked', checked ? 'true' : 'false');
    checkbox.addEventListener('click', () => {
        const now = checkbox.getAttribute('aria-checked') === 'true';
        checkbox.setAttribute('aria-checked', now ? 'false' : 'true');
    });
    message.appendChild(checkbox);
    return message;
}

function checkedStates(messages) {
    return messages.map(
        m => m.firstChild.getAttribute('aria-checked') === 'true');
}

test('selectMessages checks only the unchecked rows', () => {
    const messages = [makeMessage(false), makeMessage(true), makeMessage(false)];

    GmailToolbar.selectMessages(messages);

    expect(checkedStates(messages)).toEqual([true, true, true]);
});

test('triggerToolbarAction clicks the button once Gmail reveals the toolbar', async () => {
    document.body.innerHTML =
        '<div id="toolbar" style="display: none;"><div id="action"></div></div>';
    const button = document.getElementById('action');
    const clicks = [];
    button.addEventListener('click', () => clicks.push('click'));

    let selected = false;
    GmailToolbar.triggerToolbarAction('#action', () => { selected = true; });

    // Selection runs synchronously; the click waits for the toolbar.
    expect(selected).toBe(true);
    expect(clicks).toEqual([]);

    // Gmail reveals the toolbar in response to the selection.
    document.getElementById('toolbar').style.display = 'block';
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(clicks).toEqual(['click']);
});

test('triggerToolbarAction is a no-op when the button is missing', () => {
    document.body.innerHTML = '';
    const select = jest.fn();

    expect(() => GmailToolbar.triggerToolbarAction('#nope', select)).not.toThrow();
    expect(select).not.toHaveBeenCalled();
});
