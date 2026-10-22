// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import StarState from '../src/util/StarState';

// A message row with Gmail's star cell. `classes` is what the row was
// rendered with; `name` the star's aria-label / data-tooltip / img alt.
function row({ classes = 'aXw T-KT', name = 'Not starred', role = 'button', checked } = {}) {
    const tr = document.createElement('tr');
    tr.className = 'zA yO';
    const checkedAttr = checked === undefined ? '' : ` aria-checked="${checked}"`;
    const nameAttrs = name === null ? '' : ` aria-label="${name}" data-tooltip="${name}"`;
    tr.innerHTML = `<td class="apU xY"><span class="${classes}" role="${role}"` +
        `${nameAttrs}${checkedAttr}><img class="T-KT-JX" alt="${name || ''}"></span></td>`;
    return tr;
}

describe('isStarred', () => {
    test.each([
        ['Gmail yellow star as rendered', { classes: 'T-KT T-KT-Jp', name: 'Starred' }, true],
        ['Gmail unstarred as rendered', { classes: 'aXw T-KT', name: 'Not starred' }, false],
        ['starred live: names flipped, class still unstarred', { classes: 'aXw T-KT', name: 'Starred' }, true],
        ['unstarred live: names flipped, class still starred', { classes: 'T-KT T-KT-Jp', name: 'Not starred' }, false],
        ['a superstar without T-KT-Jp', { classes: 'T-KT', name: 'Red star' }, true],
        ['a bang superstar', { classes: 'T-KT', name: 'Orange bang' }, true],
        ['a checkbox star, checked', { classes: 'T-KT', name: 'Star', role: 'checkbox', checked: 'true' }, true],
        ['a checkbox star, unchecked', { classes: 'T-KT', name: 'Star', role: 'checkbox', checked: 'false' }, false],
        ['Spanish: destacado', { classes: 'aXw T-KT', name: 'Destacado' }, true],
        ['Spanish: no destacado', { classes: 'T-KT T-KT-Jp', name: 'No destacado' }, false],
        ['unknown locale falls back to the class (starred)', { classes: 'T-KT T-KT-Jp', name: 'Markiert' }, true],
        ['unknown locale falls back to the class (unstarred)', { classes: 'aXw T-KT', name: 'Nicht' }, false],
        ['no names at all: the class (the old fixture)', { classes: 'T-KT T-KT-Jp', name: null }, true],
    ])('%s', (_, spec, expected) => {
        expect(StarState.isStarred(row(spec))).toBe(expected);
    });

    test('a row without a star cell is not starred', () => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td class="yX"></td>';
        expect(StarState.isStarred(tr)).toBe(false);
    });
});

describe('isStarNode', () => {
    test('the star span, its img and the star cell count; other cells do not', () => {
        const tr = row();
        const td = tr.querySelector('td.apU');
        tr.insertAdjacentHTML('beforeend', '<td class="yX"><span>Sender</span></td>');
        expect(StarState.isStarNode(td)).toBe(true);
        expect(StarState.isStarNode(td.querySelector('.T-KT'))).toBe(true);
        expect(StarState.isStarNode(td.querySelector('img'))).toBe(true);
        expect(StarState.isStarNode(tr.querySelector('td.yX span'))).toBe(false);
        expect(StarState.isStarNode(null)).toBe(false);
    });
});
