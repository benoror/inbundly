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

test('deselectMessages unchecks only the checked rows', () => {
    const messages = [makeMessage(false), makeMessage(true), makeMessage(true)];

    GmailToolbar.deselectMessages(messages);

    expect(checkedStates(messages)).toEqual([false, false, false]);
});

test('triggerToolbarAction clicks the button once Gmail reveals the toolbar', async () => {
    document.body.innerHTML =
        '<div id="toolbar" style="display: none;"><div id="action"></div></div>';
    const button = document.getElementById('action');
    const clicks = [];
    button.addEventListener('click', () => clicks.push('click'));

    let selected = false;
    const done = GmailToolbar.triggerToolbarAction('#action', () => { selected = true; });

    // Selection runs synchronously; the click waits for the toolbar.
    expect(selected).toBe(true);
    expect(clicks).toEqual([]);

    // Gmail reveals the toolbar in response to the selection.
    document.getElementById('toolbar').style.display = 'block';

    expect(await done).toBe(true);
    expect(clicks).toEqual(['click']);
});

test('precededBy clicks the first button, then the freshest copy of the target', async () => {
    document.body.innerHTML = `
        <div id="toolbar" style="display: none;">
            <div id="first"></div><div id="action"></div>
        </div>`;
    const clicks = [];
    document.getElementById('first').addEventListener('click', () => {
        clicks.push('first');
        // Gmail redraws the toolbar for the first action; the old target
        // node is gone and a new one stands in its place.
        const stale = document.getElementById('action');
        const fresh = stale.cloneNode();
        fresh.addEventListener('click', () => clicks.push('action:fresh'));
        stale.replaceWith(fresh);
    });
    document.getElementById('action').addEventListener('click', () => clicks.push('action:stale'));

    const done = GmailToolbar.triggerToolbarAction('#action', () => {}, { precededBy: '#first' });
    document.getElementById('toolbar').style.display = 'block';
    await done;

    expect(clicks).toEqual(['first', 'action:fresh']);
});

test('precededBy is skipped when that button is absent or not clickable', async () => {
    document.body.innerHTML = `
        <div id="toolbar" style="display: none;">
            <div id="first" aria-disabled="true"></div><div id="action"></div>
        </div>`;
    const clicks = [];
    document.getElementById('first').addEventListener('click', () => clicks.push('first'));
    document.getElementById('action').addEventListener('click', () => clicks.push('action'));

    const first = GmailToolbar.triggerToolbarAction('#action', () => {}, { precededBy: '#first' });
    document.getElementById('toolbar').style.display = 'block';
    await first;
    document.getElementById('toolbar').style.display = 'none';
    const second = GmailToolbar.triggerToolbarAction('#action', () => {}, { precededBy: '#missing' });
    document.getElementById('toolbar').style.display = 'block';
    await second;

    expect(clicks).toEqual(['action', 'action']);
});

test('triggerToolbarAction is a no-op when the button is missing', () => {
    document.body.innerHTML = '';
    const select = jest.fn();

    expect(() => GmailToolbar.triggerToolbarAction('#nope', select)).not.toThrow();
    expect(select).not.toHaveBeenCalled();
});

// Gmail reveals the toolbar on the first checked row and writes nothing more
// while the selection grows (TESTING.md 15.10).
test('an already-revealed toolbar is clicked without waiting for a mutation', async () => {
    document.body.innerHTML = '<div id="toolbar"><div id="action"></div></div>';
    const clicks = [];
    document.getElementById('action').addEventListener('click', () => clicks.push('click'));

    expect(await GmailToolbar.triggerToolbarAction('#action', () => {})).toBe(true);
    expect(clicks).toEqual(['click']);
});

test('the shown copy of the button is clicked, not one hidden by an ancestor', async () => {
    document.body.innerHTML = `
        <div style="display: none;"><div class="tb"><div class="action" id="hidden"></div></div></div>
        <div class="tb"><div class="action" id="shown"></div></div>`;
    const clicks = [];
    document.querySelectorAll('.action').forEach(
        b => b.addEventListener('click', () => clicks.push(b.id)));

    expect(await GmailToolbar.triggerToolbarAction('.tb .action', () => {})).toBe(true);
    expect(clicks).toEqual(['shown']);
});

test('precededBy waits for Gmail to apply the first step, then re-selects', async () => {
    document.body.innerHTML = `
        <div id="toolbar"><div id="first"></div><div id="action"></div></div>`;
    const log = [];
    const first = document.getElementById('first');
    first.addEventListener('click', () => {
        log.push('first');
        // Gmail applies it a moment later: the button stays until then.
        setTimeout(() => first.setAttribute('aria-disabled', 'true'), 30);
    });
    document.getElementById('action').addEventListener('click', () => log.push('action'));

    await GmailToolbar.triggerToolbarAction(
        '#action', () => log.push('select'), { precededBy: '#first' });

    expect(log).toEqual(['select', 'first', 'select', 'action']);
});

test('a toolbar that never reveals gives up after a timeout, without clicking', async () => {
    jest.useFakeTimers();
    try {
        document.body.innerHTML =
            '<div id="toolbar" style="display: none;"><div id="action"></div></div>';
        const clicks = [];
        document.getElementById('action').addEventListener('click', () => clicks.push('click'));

        const done = GmailToolbar.triggerToolbarAction('#action', () => {});
        expect(GmailToolbar.isBusy()).toBe(true);
        jest.advanceTimersByTime(3100);

        expect(await done).toBe(false);
        expect(clicks).toEqual([]);
        expect(GmailToolbar.isBusy()).toBe(false);
    }
    finally {
        jest.useRealTimers();
    }
});

test('a newer action supersedes one still waiting, which never clicks', async () => {
    document.body.innerHTML =
        '<div id="toolbar" style="display: none;"><div id="action"></div></div>';
    const clicks = [];
    document.getElementById('action').addEventListener('click', () => clicks.push('click'));

    const stale = GmailToolbar.triggerToolbarAction('#action', () => {});
    const fresh = GmailToolbar.triggerToolbarAction('#action', () => {});
    document.getElementById('toolbar').style.display = 'block';

    expect(await stale).toBe(false);
    expect(await fresh).toBe(true);
    expect(clicks).toEqual(['click']);
});
