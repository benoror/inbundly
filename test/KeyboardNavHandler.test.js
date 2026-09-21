// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import KeyboardNavHandler from '../src/handlers/KeyboardNavHandler';
import Bundle from '../src/containers/Bundle';
import GmailToolbar from '../src/util/GmailToolbar';

// Display order (flex `order`): A(100) [Work bundle](200) B(300); the bundle's
// threads W1 and W2 sit in the DOM between them, hidden until the bundle opens.
function buildInbox() {
    document.documentElement.className = 'inbundly';
    document.body.innerHTML = `
        <div role="main">
          <div class="G-atb"><div class="G-Ni">
            <div class="T-I J-J5-Ji" act="7"></div>
          </div></div>
          <div class="ae4" role="tabpanel">
            <div class="Cp"><table class="F"><tbody data-inbundly-section="0">
              <tr class="zA yO" id="a" style="order: 100"><td><div class="oZ-jc T-Jo J-J5-Ji" aria-checked="false"></div></td><td>A</td></tr>
              <tr class="zA yO bundled-message" id="w1"><td><div class="oZ-jc T-Jo J-J5-Ji" aria-checked="false"></div></td><td>W1</td></tr>
              <tr class="zA yO" id="b" style="order: 300"><td><div class="oZ-jc T-Jo J-J5-Ji" aria-checked="false"></div></td><td>B</td></tr>
              <tr class="zA yO bundled-message" id="w2"><td><div class="oZ-jc T-Jo J-J5-Ji" aria-checked="false"></div></td><td>W2</td></tr>
              <tr class="zA yO bundle-row" id="work" style="order: 200">
                <td><span class="bundle-checkbox" role="checkbox" aria-checked="false"></span></td>
                <td>Work</td>
                <td><span class="archive-bundle"></span><span class="snooze-bundle"></span><span class="delete-bundle"></span></td>
              </tr>
            </tbody></table></div>
          </div>
        </div>
        <input id="search">`;

    // Gmail behaviour: a checkbox click toggles the row's selection.
    document.querySelectorAll('.oZ-jc').forEach(cb => cb.addEventListener('click', () => {
        const on = cb.getAttribute('aria-checked') === 'true';
        cb.setAttribute('aria-checked', on ? 'false' : 'true');
        cb.closest('tr').classList.toggle('x7', !on);
    }));

    const bundle = new Bundle('Work', '0');
    bundle.addMessage(document.getElementById('w1'));
    bundle.addMessage(document.getElementById('w2'));
    bundle.setBundleRow(document.getElementById('work'));
    bundle.setOrder(200);
    return bundle;
}

function createHandler(bundle, { open = false, active = true } = {}) {
    const bundledMail = {
        getAllBundles: () => [bundle],
        getOpenedBundle: () => (open ? bundle : null),
    };
    const bundleToggler = { toggleBundle: jest.fn() };
    const handler = new KeyboardNavHandler(bundledMail, bundleToggler, () => active);
    return { handler, bundleToggler };
}

// Mirror BundleToggler.openBundle: reveal the threads right after their
// bundle row (order + 1..n).
function openBundle(bundle) {
    bundle.getMessages().forEach((m, i) => {
        m.classList.add('visible');
        m.style.order = bundle.getOrder() + i + 1;
    });
}

function press(handler, key, overrides = {}) {
    const e = {
        isTrusted: true,
        key,
        target: document.activeElement || document.body,
        preventDefault: jest.fn(),
        stopImmediatePropagation: jest.fn(),
        ...overrides,
    };
    handler.handleKeyDown(e);
    return e;
}

function focused() {
    return document.activeElement && document.activeElement.id;
}

let bundle;
beforeEach(() => {
    bundle = buildInbox();
});

test('navigable rows follow display order and skip hidden bundled threads', () => {
    const { handler } = createHandler(bundle);
    expect(handler.getNavigableRows().map(r => r.id)).toEqual(['a', 'work', 'b']);

    openBundle(bundle);
    expect(handler.getNavigableRows().map(r => r.id)).toEqual(['a', 'work', 'w1', 'w2', 'b']);
});

test('j/k walk the visible rows, landing on the bundle row as a first-class stop', () => {
    const { handler } = createHandler(bundle);

    let e = press(handler, 'j');
    expect(focused()).toBe('a');
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopImmediatePropagation).toHaveBeenCalled();

    press(handler, 'j');
    expect(focused()).toBe('work');
    expect(document.getElementById('work').classList.contains('inbundly-cursor')).toBe(true);

    press(handler, 'j');
    expect(focused()).toBe('b');
    expect(document.querySelector('.inbundly-cursor')).toBeNull();

    // End of the list: the key is still swallowed so Gmail can't walk on.
    e = press(handler, 'j');
    expect(focused()).toBe('b');
    expect(e.preventDefault).toHaveBeenCalled();

    press(handler, 'k');
    expect(focused()).toBe('work');
});

test('k with no cursor starts from the bottom', () => {
    const { handler } = createHandler(bundle);
    press(handler, 'k');
    expect(focused()).toBe('b');
});

test('a Gmail cursor left on a hidden bundled thread continues from its bundle row', () => {
    const { handler } = createHandler(bundle);
    document.getElementById('w2').classList.add('btb');

    press(handler, 'j');
    // Gmail alone would step from W2 to the next DOM row; the visible step
    // from the Work bundle is B.
    expect(focused()).toBe('b');
});

test('arrow keys only take over once focus is in the list', () => {
    const { handler } = createHandler(bundle);

    let e = press(handler, 'ArrowDown');
    expect(focused()).not.toBe('a');
    expect(e.preventDefault).not.toHaveBeenCalled();

    press(handler, 'j');
    e = press(handler, 'ArrowDown');
    expect(focused()).toBe('work');
    expect(e.preventDefault).toHaveBeenCalled();
});

test('stays out of the way when inactive, typing, or with modifiers', () => {
    const { handler } = createHandler(bundle, { active: false });
    let e = press(handler, 'j');
    expect(e.preventDefault).not.toHaveBeenCalled();

    const { handler: live } = createHandler(bundle);
    const search = document.getElementById('search');
    search.focus();
    e = press(live, 'j', { target: search });
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(focused()).toBe('search');

    document.body.focus();
    e = press(live, 'j', { ctrlKey: true });
    expect(e.preventDefault).not.toHaveBeenCalled();

    e = press(live, 'j', { isTrusted: false });
    expect(e.preventDefault).not.toHaveBeenCalled();
});

test('Enter and o on a bundle row toggle it', () => {
    const { handler, bundleToggler } = createHandler(bundle);
    press(handler, 'j');
    press(handler, 'j');
    expect(focused()).toBe('work');

    press(handler, 'Enter');
    expect(bundleToggler.toggleBundle).toHaveBeenCalledWith('0', 'Work');

    const e = press(handler, 'o');
    expect(bundleToggler.toggleBundle).toHaveBeenCalledTimes(2);
    expect(e.preventDefault).toHaveBeenCalled();
});

test('x on a bundle row drives its select-all checkbox', () => {
    const { handler } = createHandler(bundle);
    const checkbox = document.querySelector('.bundle-checkbox');
    const clicked = jest.fn();
    checkbox.addEventListener('click', clicked);

    press(handler, 'j');
    press(handler, 'j');
    press(handler, 'x');

    expect(clicked).toHaveBeenCalledTimes(1);
});

test('e/#/b on a bundle row run its actions only when shown and enabled', () => {
    const { handler } = createHandler(bundle);
    const clicks = {};
    ['archive-bundle', 'snooze-bundle', 'delete-bundle'].forEach(cls => {
        clicks[cls] = jest.fn();
        document.querySelector(`.${cls}`).addEventListener('click', clicks[cls]);
    });
    press(handler, 'j');
    press(handler, 'j');

    press(handler, 'e');
    expect(clicks['archive-bundle']).toHaveBeenCalledTimes(1);
    press(handler, 'y');
    expect(clicks['archive-bundle']).toHaveBeenCalledTimes(2);
    press(handler, 'b');
    expect(clicks['snooze-bundle']).toHaveBeenCalledTimes(1);

    // Delete-all is hidden by option (the default): the key is swallowed, not run.
    document.documentElement.classList.add('hide-bundle-delete');
    let e = press(handler, '#');
    expect(clicks['delete-bundle']).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();

    document.documentElement.classList.remove('hide-bundle-delete');
    press(handler, '#');
    expect(clicks['delete-bundle']).toHaveBeenCalledTimes(1);

    // A disabled action (message outside the bundle selected) stays inert.
    document.querySelector('.archive-bundle').classList.add('disabled');
    e = press(handler, 'e');
    expect(clicks['archive-bundle']).toHaveBeenCalledTimes(2);
    expect(e.preventDefault).toHaveBeenCalled();
});

test('other thread shortcuts on a bundle row are swallowed; the rest pass', () => {
    const { handler } = createHandler(bundle);
    press(handler, 'j');
    press(handler, 'j');

    ['s', '!', 'v', 'l', 'I', 'U', 'r', '.'].forEach(key => {
        const e = press(handler, key);
        expect(e.preventDefault).toHaveBeenCalled();
    });
    ['c', '/', 'g', 'z', '?', 'Tab', 'Escape'].forEach(key => {
        const e = press(handler, key);
        expect(e.preventDefault).not.toHaveBeenCalled();
    });
});

test('Escape inside the open bundle collapses it and lands on the bundle row', () => {
    openBundle(bundle);
    const { handler, bundleToggler } = createHandler(bundle, { open: true });
    press(handler, 'j');
    press(handler, 'j');
    press(handler, 'j');
    expect(focused()).toBe('w1');

    const e = press(handler, 'Escape');
    expect(bundleToggler.toggleBundle).toHaveBeenCalledWith('0', 'Work');
    expect(focused()).toBe('work');
    expect(e.preventDefault).toHaveBeenCalled();
});

test('Escape on the open bundle\'s row collapses it too', () => {
    openBundle(bundle);
    const { handler, bundleToggler } = createHandler(bundle, { open: true });
    press(handler, 'j');
    press(handler, 'j');

    press(handler, 'Escape');
    expect(bundleToggler.toggleBundle).toHaveBeenCalledTimes(1);
    expect(focused()).toBe('work');
});

describe('when Gmail\'s cursor mark follows focus', () => {
    test('shortcuts on a message row pass through to Gmail', () => {
        const { handler } = createHandler(bundle);
        press(handler, 'j');
        document.getElementById('a').classList.add('btb');

        ['e', 'x', 'Enter', '#'].forEach(key => {
            const e = press(handler, key);
            expect(e.preventDefault).not.toHaveBeenCalled();
        });
    });
});

describe('when Gmail\'s cursor mark does not follow focus', () => {
    test('e archives the visible row through the toolbar', () => {
        const { handler } = createHandler(bundle);
        const spy = jest.spyOn(GmailToolbar, 'triggerToolbarAction').mockImplementation(
            (selector, select) => select());
        press(handler, 'j');

        const e = press(handler, 'e');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('act="7"');
        expect(document.querySelector('#a .oZ-jc').getAttribute('aria-checked')).toBe('true');
        expect(e.preventDefault).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('x toggles the visible row\'s checkbox; Enter clicks the row', () => {
        const { handler } = createHandler(bundle);
        const row = document.getElementById('a');
        const rowClicked = jest.fn();
        row.addEventListener('click', rowClicked);
        press(handler, 'j');

        press(handler, 'Enter');
        expect(rowClicked).toHaveBeenCalledTimes(1);

        press(handler, 'x');
        expect(row.querySelector('.oZ-jc').getAttribute('aria-checked')).toBe('true');
        expect(row.classList.contains('x7')).toBe(true);
    });

    test('an existing selection is Gmail\'s to act on', () => {
        const { handler } = createHandler(bundle);
        const spy = jest.spyOn(GmailToolbar, 'triggerToolbarAction').mockImplementation(() => {});
        document.getElementById('b').classList.add('x7');
        press(handler, 'j');

        const e = press(handler, 'e');

        expect(spy).not.toHaveBeenCalled();
        expect(e.preventDefault).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
