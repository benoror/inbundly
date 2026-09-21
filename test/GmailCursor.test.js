// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import GmailCursor from '../src/util/GmailCursor';

function buildList() {
    document.body.innerHTML = `
        <div role="main">
          <div class="ae4" role="tabpanel">
            <div class="Cp"><table class="F"><tbody data-inbundly-section="0">
              <tr class="zA yO" id="a"><td>A</td></tr>
              <tr class="zA yO btb" id="b"><td>B</td></tr>
              <tr class="zA yO bundle-row" id="bundle"><td>Work</td></tr>
            </tbody></table></div>
          </div>
        </div>
        <table><tbody><tr class="zA" id="outside"><td>elsewhere</td></tr></tbody></table>
        <input id="search">`;
}

beforeEach(buildList);

test('reads the row Gmail marks as its cursor', () => {
    expect(GmailCursor.getMarkedRow().id).toBe('b');
    expect(GmailCursor.isMarked(document.getElementById('b'))).toBe(true);
    expect(GmailCursor.isMarked(document.getElementById('a'))).toBe(false);
});

test('the focused row counts only inside a bundled section', () => {
    expect(GmailCursor.getFocusedRow()).toBeNull();

    const outside = document.getElementById('outside');
    outside.tabIndex = -1;
    outside.focus();
    expect(GmailCursor.getFocusedRow()).toBeNull();

    document.getElementById('search').focus();
    expect(GmailCursor.getFocusedRow()).toBeNull();

    GmailCursor.focusRow(document.getElementById('a'));
    expect(GmailCursor.getFocusedRow().id).toBe('a');
});

test('focusing a message row makes it focusable and remembers it', () => {
    const a = document.getElementById('a');
    expect(a.hasAttribute('tabindex')).toBe(false);

    GmailCursor.focusRow(a);

    expect(a.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(a);
    expect(GmailCursor.getLastFocusedRow()).toBe(a);
    // Gmail's own mark is left for Gmail to move.
    expect(document.getElementById('b').classList.contains('btb')).toBe(true);
});

test('focusing a bundle row draws inbundly\'s cursor and clears Gmail\'s mark', () => {
    const bundleRow = document.getElementById('bundle');

    GmailCursor.focusRow(bundleRow);

    expect(document.activeElement).toBe(bundleRow);
    expect(bundleRow.classList.contains('inbundly-cursor')).toBe(true);
    expect(document.querySelector('.btb')).toBeNull();

    GmailCursor.focusRow(document.getElementById('a'));
    expect(bundleRow.classList.contains('inbundly-cursor')).toBe(false);
});

test('a remembered row that left the document is forgotten', () => {
    const a = document.getElementById('a');
    GmailCursor.focusRow(a);
    a.remove();
    expect(GmailCursor.getLastFocusedRow()).toBeNull();
});

test('focusing nothing is a no-op', () => {
    expect(() => GmailCursor.focusRow(null)).not.toThrow();
});
