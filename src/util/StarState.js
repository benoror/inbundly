// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

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

import { GmailClasses } from './Constants';

// One answer to "is this message row starred?" for every inbundly path
// (bundling with keepStarredUnbundled, the live star-flip redraw, the archive
// switches). Gmail's row star is a span in the star cell (td.apU), with an
// <img class="T-KT-JX"> inside:
//
//   <td class="apU xY"><span class="aXw T-KT" role="button"
//       aria-label="Not starred" data-tooltip="Not starred">
//     <img class="T-KT-JX" alt="Not starred"></span></td>
//
// Its class (T-KT-Jp starred, aXw not) is what the list was rendered with.
// The accessible state (aria-checked when the star is a checkbox, aria-label /
// data-tooltip / title / the img's alt) is what Gmail keeps current when the
// user clicks the star, and it is the only signal for a superstar ("Red star",
// "Orange bang", ...) that is not drawn with the yellow star's T-KT-Jp. So the
// accessible state wins, and the class is the fallback (an unknown locale).

const STAR_CELL = 'td.apU';
const STAR_CONTROL = `${STAR_CELL} .T-KT, ${STAR_CELL} [role="button"], ` +
    `${STAR_CELL} [role="checkbox"], .T-KT`;

// English and Spanish names Gmail gives the star control. Negative first:
// "Not starred" contains "starred". The English superstars are a color and a
// kind ("Red star", "Orange guillemet", "Blue info", ...); a bare "Star" (an
// action name) is not read as a state.
const NOT_STARRED = /\b(not starred|unstarred)\b|no destacad|sin estrella|no marcad/i;
const STARRED = new RegExp([
    '\\bstarred\\b',
    '\\b(yellow|orange|red|purple|blue|green)[ -](star|bang|guillemet|check|info|question)\\b',
    'destacad',
    'estrella',
].join('|'), 'i');

/**
 * The star control of a message row, or null.
 */
function findStar(row) {
    return row && row.querySelector ? row.querySelector(STAR_CONTROL) : null;
}

function _labelsOf(star) {
    const img = star.querySelector('img');
    return [
        star.getAttribute('aria-label'),
        star.getAttribute('data-tooltip'),
        star.getAttribute('title'),
        img && img.getAttribute('alt'),
    ].map(value => (value || '').trim()).filter(Boolean);
}

/**
 * Starred state of a star control: true, false, or null when it says nothing.
 */
function starStateOf(star) {
    if (!star) {
        return null;
    }
    const checked = star.getAttribute('aria-checked');
    if (checked === 'true' || checked === 'false') {
        return checked === 'true';
    }
    // The first name that reads either way decides (aria-label before the
    // tooltip and alt, which Gmail may refresh later).
    for (const label of _labelsOf(star)) {
        if (NOT_STARRED.test(label)) {
            return false;
        }
        if (STARRED.test(label)) {
            return true;
        }
    }
    if (star.classList.contains(GmailClasses.STARRED)) {
        return true;
    }
    if (star.classList.contains(GmailClasses.UNSTARRED)) {
        return false;
    }
    return null;
}

/**
 * True if the message row is starred (any star type).
 */
function isStarred(row) {
    const star = findStar(row);
    const state = starStateOf(star);
    if (state !== null) {
        return state;
    }
    // No readable star control: the class anywhere in the row, as before.
    return !!(row && row.querySelector && row.querySelector(`.${GmailClasses.STARRED}`));
}

/**
 * True if `node` is a row's star control or sits inside its star cell, i.e.
 * a mutation or click on it may have flipped the star.
 */
function isStarNode(node) {
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!el || !el.closest) {
        return false;
    }
    return !!el.closest(`${STAR_CELL}, .T-KT`);
}

export default {
    findStar,
    starStateOf,
    isStarred,
    isStarNode,
};
