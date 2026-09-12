// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

// Gmail-shaped fixture page for the Playwright e2e suite.
//
// The DOM here follows the selector contract in src/util/Constants.js — the
// only Gmail surface the extension can see. Structure verified against live
// Gmail on 2026-09-09 (see TESTING.md, "How the e2e suite works"). When Gmail
// markup changes, update Constants.js and this file together.
//
// The page also emulates the Gmail behaviors the extension depends on:
//  - clicking a row checkbox toggles aria-checked and the row's `x7`
//    (selected) class, and shows/hides the toolbar action cluster;
//  - toolbar action clicks are recorded on window.__gmail.clicks;
//  - the keyboard cursor: rows are focusable (tabindex=-1), the cursor row
//    carries `btb`, j/k walk Gmail's own DOM-ordered list (hidden rows
//    included), and e/x/Enter act on the checked rows or the cursor row.
//    Thread actions land on window.__gmail.actions. By default the cursor
//    follows DOM focus, the model the extension relies on (TESTING.md §12);
//    `cursorFollowsFocus: false` builds a Gmail whose cursor ignores focus,
//    for the extension's fallback paths.

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

/**
 * Gmail-style date tooltip for `daysAgo`, e.g. "Wed, Sep 9, 2026, 10:00 AM".
 * Bundler date grouping parses this with `new Date(title)`.
 */
function dateTitle(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(10, 0, 0, 0);
    return d.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

function dateText(daysAgo) {
    if (daysAgo === 0) {
        return '10:00 AM';
    }
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

let nextThreadNumber = 1;

/**
 * One Gmail message row. Options:
 *   sender  - display name (default derived from email)
 *   email   - sender address (put on span[email], like Gmail)
 *   subject - subject text
 *   labels  - visible label chip names (Gmail shows these when labels are
 *             shown in the message list)
 *   daysAgo - age of the thread (drives the date cell), default 0
 *   unread  - bold/unread styling class (zE) vs read (yO), default false
 *   starred - star cell state, default false
 */
function threadRow({
    sender,
    email = 'someone@example.com',
    subject = 'A subject',
    labels = [],
    daysAgo = 0,
    unread = false,
    starred = false,
} = {}) {
    // Hex thread id shaped like Gmail's data-legacy-thread-id.
    const threadId = '1a' + (nextThreadNumber++).toString(16).padStart(13, '0');
    // Real Gmail rows carry a unique element id; the bulk-action disable rule
    // compares selected rows to bundle members by it.
    const rowId = `:fixture-row-${threadId}`;
    const name = sender || (email ? email.split('@')[0] : 'Sender');
    const labelChips = labels.map(l => `
        <div class="ar as" title=""><div class="at" title="${escapeHtml(l)}">
            <div class="av">${escapeHtml(l)}</div>
        </div></div>`).join('');
    const starClasses = starred ? 'T-KT T-KT-Jp' : 'T-KT aXw';

    return `
        <tr class="zA ${unread ? 'zE' : 'yO'}" role="row" id="${rowId}" tabindex="-1">
            <td class="PF xY"></td>
            <td class="oZ-x3 xY" data-tooltip="Select">
                <div class="oZ-jc T-Jo J-J5-Ji" role="checkbox" aria-checked="false" tabindex="-1"></div>
            </td>
            <td class="apU xY"><span class="${starClasses}" role="button"></span></td>
            <td class="yX xY" role="gridcell">
                <div class="yW">
                    <span class="bA4">
                        <span email="${escapeHtml(email)}" name="${escapeHtml(name)}"
                            data-legacy-thread-id="${threadId}">${escapeHtml(name)}</span>
                    </span>
                </div>
            </td>
            <td class="xY a4W" role="gridcell">
                <div class="xS"><div class="xT">
                    <div class="y6"><span><span>${escapeHtml(subject)}</span></span></div>
                    ${labelChips}
                </div></div>
            </td>
            <td class="byZ xY" role="gridcell"></td>
            <td class="yf xY"></td>
            <td class="xW xY" role="gridcell">
                <span title="${dateTitle(daysAgo)}"><span>${dateText(daysAgo)}</span></span>
            </td>
        </tr>`;
}

/**
 * A full Gmail-shaped inbox page holding the given thread rows.
 * `threads` is an array of threadRow() option objects.
 */
function inboxPage({ threads = [], tab = 'Primary', cursorFollowsFocus = true } = {}) {
    const rows = threads.map(threadRow).join('\n');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Inbox - fixture - Gmail</title>
<style>
  /* Just enough layout for offset math; the extension ships its own CSS. */
  body { margin: 0; font: 13px sans-serif; }
  tr.zA { height: 28px; }
  /* Gmail's stylesheet gives these size; tests need real bounding boxes. */
  .G-atb .T-I { display: inline-block; width: 24px; height: 24px; }
  td.oZ-x3 .oZ-jc { display: inline-block; width: 16px; height: 16px; }
</style>
</head>
<body>
<input id="fixture-search" aria-label="Search mail">
<div class="nH">
  <div class="BltHke nH oy8Mbf" role="main">
    <div class="G-atb" gh="tm">
      <div class="G-Ni" style="display: none;">
        <div class="T-I J-J5-Ji" act="7" aria-label="Archive" role="button"></div>
        <div class="T-I J-J5-Ji" act="10" data-tooltip="Delete" aria-label="Delete" role="button"></div>
        <div class="T-I J-J5-Ji" data-tooltip="Snooze" aria-label="Snooze" role="button"></div>
      </div>
      <div class="T-I J-J5-Ji" act="20" aria-label="Refresh" role="button"></div>
    </div>
    <div role="tablist">
      <div role="tab" aria-selected="true" aria-label="${escapeHtml(tab)}">${escapeHtml(tab)}</div>
    </div>
    <div class="UI">
      <div class="aDP">
        <div class="ae4 aDM" role="tabpanel">
          <div class="Cp"></div>
          <div class="Cp">
            <div>
              <table class="F cf zt" role="grid">
                <tbody class="flex-table-body">
${rows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
(function emulateGmail() {
    window.__gmail = { clicks: [], actions: [] };

    // Gmail behavior: a row checkbox click toggles the row's selected state
    // and reveals the toolbar's action cluster while anything is selected.
    document.querySelectorAll('td.oZ-x3 .oZ-jc').forEach(cb => {
        cb.addEventListener('click', () => {
            const on = cb.getAttribute('aria-checked') === 'true';
            cb.setAttribute('aria-checked', on ? 'false' : 'true');
            cb.closest('tr').classList.toggle('x7', !on);
            // Only message rows count as selected: the extension mirrors a
            // full selection onto its bundle row as x7 too, and clears it
            // asynchronously, so matching it here would keep the toolbar
            // revealed after a deselect-all (real Gmail uses its own model).
            const anySelected = !!document.querySelector('tr.zA.x7:not(.bundle-row)');
            document.querySelector('.G-Ni').style.display = anySelected ? '' : 'none';
        });
    });

    // Record toolbar action clicks so tests can assert them. Archive also
    // lands on the actions log, with the rows it would act on.
    document.querySelectorAll('.G-atb .T-I').forEach(button => {
        button.addEventListener('click', () => {
            window.__gmail.clicks.push(
                button.getAttribute('data-tooltip') ||
                'act:' + button.getAttribute('act'));
            if (button.getAttribute('act') === '7') {
                window.__gmail.actions.push({
                    type: 'archive',
                    subjects: messageRows().filter(isSelected).map(subjectOf),
                });
            }
        });
    });

    // --- Keyboard cursor -------------------------------------------------
    // Gmail's own list is the DOM order of its rows; bundle rows are not in
    // it, and rows hidden inside a collapsed bundle are.
    const CURSOR_FOLLOWS_FOCUS = ${cursorFollowsFocus ? 'true' : 'false'};

    function messageRows() {
        return [...document.querySelectorAll('tr.zA:not(.bundle-row)')];
    }
    function isSelected(row) {
        return row.classList.contains('x7');
    }
    function subjectOf(row) {
        const subject = row.querySelector('.y6 span span');
        return subject ? subject.textContent : '';
    }
    function cursorRow() {
        return document.querySelector('tr.zA.btb:not(.bundle-row)');
    }
    function markCursor(row) {
        messageRows().forEach(r => r.classList.toggle('btb', r === row));
    }
    function record(type, rows) {
        window.__gmail.actions.push({ type, subjects: rows.map(subjectOf) });
    }

    if (CURSOR_FOLLOWS_FOCUS) {
        document.addEventListener('focusin', e => {
            const row = e.target.closest && e.target.closest('tr.zA:not(.bundle-row)');
            if (row) {
                markCursor(row);
            }
        });
    }

    document.addEventListener('keydown', e => {
        if (e.target.closest('input, textarea')) {
            return;
        }
        const list = messageRows();
        const current = cursorRow();
        const index = list.indexOf(current);
        const actOn = () => {
            const selected = list.filter(isSelected);
            return selected.length ? selected : (current ? [current] : []);
        };
        switch (e.key) {
            case 'j':
            case 'ArrowDown':
            case 'k':
            case 'ArrowUp': {
                const forward = e.key === 'j' || e.key === 'ArrowDown';
                const next = index === -1
                    ? list[forward ? 0 : list.length - 1]
                    : list[index + (forward ? 1 : -1)];
                if (next) {
                    markCursor(next);
                    if (CURSOR_FOLLOWS_FOCUS) {
                        // A display:none row cannot take focus; Gmail's
                        // internal cursor still moves there.
                        next.focus();
                    }
                }
                break;
            }
            case 'e':
                record('archive', actOn());
                break;
            case 's':
                record('star', actOn());
                break;
            case 'x':
                if (current) {
                    current.querySelector('.oZ-jc').click();
                }
                break;
            case 'Enter':
            case 'o':
                if (current) {
                    record('open', [current]);
                }
                break;
        }
    });

    // Clicking a row (not its checkbox or star) opens the thread.
    messageRows().forEach(row => {
        row.addEventListener('click', e => {
            if (!e.target.closest('.oZ-jc, .T-KT')) {
                record('open', [row]);
            }
        });
    });
})();
</script>
</body>
</html>`;
}

module.exports = { inboxPage, threadRow, dateTitle };
