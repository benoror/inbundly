import BundleCheckbox from '../src/components/BundleCheckbox';
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

describe('BundleCheckbox', () => {
    test('click selects every unselected message', () => {
        const messages = [makeMessage(false), makeMessage(true), makeMessage(false)];
        const checkbox = BundleCheckbox.create(messages);

        checkbox.click();

        expect(checkedStates(messages)).toEqual(['true', 'true', 'true']);
    });

    test('click deselects all messages when every one is selected', () => {
        const messages = [makeMessage(true), makeMessage(true)];
        const checkbox = BundleCheckbox.create(messages);

        checkbox.click();

        expect(checkedStates(messages)).toEqual(['false', 'false']);
    });

    test('click does not bubble to the bundle row', () => {
        const messages = [makeMessage(false)];
        const checkbox = BundleCheckbox.create(messages);
        const row = document.createElement('tr');
        row.appendChild(checkbox);
        const rowListener = jest.fn();
        row.addEventListener('click', rowListener);

        checkbox.click();

        expect(rowListener).not.toHaveBeenCalled();
    });

    test('is not matched by the quick-select checkbox selector', () => {
        // The checkbox carries Gmail's checkbox classes for styling; the
        // quick-select handler must not attach to it (it re-dispatches
        // click() on its target, which would double-toggle the bundle).
        document.body.innerHTML = `
            <div role="main"><div class="ae4">
                <table><tbody><tr><td id="cell"></td></tr></tbody></table>
            </div></div>
        `;
        const checkbox = BundleCheckbox.create([makeMessage(false)]);
        document.getElementById('cell').appendChild(checkbox);

        const matches = [...document.querySelectorAll(Selectors.CHECKBOXES)];

        expect(checkbox.className).toContain('oZ-jc');
        expect(matches).not.toContain(checkbox);
    });

    test('renders as an unchecked accessible checkbox', () => {
        const checkbox = BundleCheckbox.create([makeMessage(false)]);

        expect(checkbox.getAttribute('role')).toBe('checkbox');
        expect(checkbox.getAttribute('aria-checked')).toBe('false');
        expect(checkbox.classList.contains('bundle-checkbox')).toBe(true);
    });
});
