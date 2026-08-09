// inboxy: Chrome extension for Google Inbox-style bundles in Gmail.
// Copyright (C) 2020  Teresa Ou

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

import DomUtils from '../src/util/DomUtils';

/**
 * Build a message row containing a Gmail-style label chip, mirroring the
 * `.ar.as > .at[title] > .au > .av` structure that getLabelColors reads from.
 */
function messageWithLabel(title, { background, color, emptyTitle = false } = {}) {
    const message = document.createElement('tr');
    const container = document.createElement('div');
    container.className = 'ar as';

    const chip = document.createElement('div');
    chip.className = 'at';
    if (!emptyTitle) {
        chip.title = title;
    }
    if (background) {
        chip.style.backgroundColor = background;
    }

    const inner = document.createElement('div');
    inner.className = 'au';
    const text = document.createElement('div');
    text.className = 'av';
    if (color) {
        text.style.color = color;
    }
    text.textContent = title;

    inner.appendChild(text);
    chip.appendChild(inner);
    container.appendChild(chip);
    message.appendChild(container);
    return message;
}

//
// getThreadId
//

test('getThreadId - reads the stable legacy thread id from the row', () => {
    const message = document.createElement('tr');
    const span = document.createElement('span');
    span.setAttribute('data-legacy-thread-id', '19fa54e3abd9ff57');
    message.appendChild(span);

    expect(DomUtils.getThreadId(message)).toBe('19fa54e3abd9ff57');
});

test('getThreadId - returns null when the row has no thread id', () => {
    const message = document.createElement('tr');
    expect(DomUtils.getThreadId(message)).toBeNull();
});

//
// getLabelStrings / getLabelName
//

test('getLabelStrings - reads titles from classic chips', () => {
    const message = messageWithLabel('IH/Kamek.ai');
    message.appendChild(messageWithLabel('Procevi').firstChild);

    expect(DomUtils.getLabelStrings(message)).toEqual(['IH/Kamek.ai', 'Procevi']);
});

test('getLabelStrings - falls back to .av text when chip title is empty', () => {
    const message = messageWithLabel('IH/Kamek.ai', { emptyTitle: true });
    message.appendChild(messageWithLabel('Procevi', { emptyTitle: true }).firstChild);

    expect(DomUtils.getLabelStrings(message)).toEqual(['IH/Kamek.ai', 'Procevi']);
});

test('getLabelStrings - falls back to a titled descendant when .at title is empty', () => {
    const message = document.createElement('tr');
    const container = document.createElement('div');
    container.className = 'ar as';
    const chip = document.createElement('div');
    chip.className = 'at';
    const nested = document.createElement('span');
    nested.title = 'IH/Spoînt/BrokerLit';
    nested.textContent = 'BrokerLit';
    chip.appendChild(nested);
    container.appendChild(chip);
    message.appendChild(container);

    expect(DomUtils.getLabelStrings(message)).toEqual(['IH/Spoînt/BrokerLit']);
});

test('getLabelName - prefers a full-path sibling title over short .av text', () => {
    const message = document.createElement('tr');
    const cell = document.createElement('td');
    const tooltip = document.createElement('div');
    tooltip.title = 'IH/Kamek.ai';
    const container = document.createElement('div');
    container.className = 'ar as';
    const chip = document.createElement('div');
    chip.className = 'at';
    const av = document.createElement('div');
    av.className = 'av';
    av.textContent = 'Kamek.ai';
    chip.appendChild(av);
    container.appendChild(chip);
    cell.appendChild(tooltip);
    cell.appendChild(container);
    message.appendChild(cell);

    expect(DomUtils.getLabelName(chip)).toBe('IH/Kamek.ai');
    expect(DomUtils.getLabelStrings(message)).toEqual(['IH/Kamek.ai']);
});

test('getLabelColors - still finds a chip when only .av carries the name', () => {
    const message = messageWithLabel('Work', {
        background: 'rgb(251, 233, 231)',
        color: 'rgb(0, 0, 0)',
        emptyTitle: true,
    });

    expect(DomUtils.getLabelColors(message, 'Work')).toEqual({
        background: 'rgb(251, 233, 231)',
        color: 'rgb(0, 0, 0)',
    });
});

//
// getLabelColors
//

test('getLabelColors - reads background and text color from the label chip', () => {
    const message = messageWithLabel('Work', {
        background: 'rgb(251, 233, 231)',
        color: 'rgb(0, 0, 0)',
    });

    expect(DomUtils.getLabelColors(message, 'Work')).toEqual({
        background: 'rgb(251, 233, 231)',
        color: 'rgb(0, 0, 0)',
    });
});

test('getLabelColors - returns null when the label has no custom color', () => {
    const message = messageWithLabel('Work');
    expect(DomUtils.getLabelColors(message, 'Work')).toBeNull();
});

test('getLabelColors - returns null when the label is not present', () => {
    const message = messageWithLabel('Work', { background: 'rgb(1, 2, 3)' });
    expect(DomUtils.getLabelColors(message, 'School')).toBeNull();
});

//
// pickAccentColor
//

test('pickAccentColor - light theme picks the darker of the two colors', () => {
    // Light-green background with dark-green text -> dark green reads on white
    const colors = { background: 'rgb(66, 214, 146)', color: 'rgb(9, 66, 40)' };
    expect(DomUtils.pickAccentColor(colors, false)).toBe('rgb(9, 66, 40)');
});

test('pickAccentColor - light theme avoids a white label text color', () => {
    // Blue background with white text -> white would vanish, so pick the blue
    const colors = { background: 'rgb(74, 134, 232)', color: 'rgb(255, 255, 255)' };
    expect(DomUtils.pickAccentColor(colors, false)).toBe('rgb(74, 134, 232)');
});

test('pickAccentColor - dark theme picks the lighter of the two colors', () => {
    const colors = { background: 'rgb(66, 214, 146)', color: 'rgb(9, 66, 40)' };
    expect(DomUtils.pickAccentColor(colors, true)).toBe('rgb(66, 214, 146)');
});

test('pickAccentColor - falls back to background when there is no text color', () => {
    expect(DomUtils.pickAccentColor({ background: 'rgb(1, 2, 3)', color: null }, false))
        .toBe('rgb(1, 2, 3)');
});

test('getLabelColors - matches the correct label among several', () => {
    const message = document.createElement('tr');
    message.appendChild(
        messageWithLabel('Work', { background: 'rgb(251, 233, 231)' }).firstChild);
    message.appendChild(
        messageWithLabel('School', { background: 'rgb(200, 230, 201)' }).firstChild);

    expect(DomUtils.getLabelColors(message, 'School')).toEqual({
        background: 'rgb(200, 230, 201)',
        color: null,
    });
});
