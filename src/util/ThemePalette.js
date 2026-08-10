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

//
// Catppuccin palette (https://github.com/catppuccin/catppuccin, MIT). A themed
// userstyle (e.g. the Catppuccin Gmail style, applied via Stylus) leaves Gmail's
// label chips at Google's default colors, which clash with the theme. When we
// detect such a theme, we snap each label's color to the nearest accent in the
// active flavor so bundles look native to the theme.
//

const FLAVORS = {
    latte:     { dark: false, base: '#eff1f5', neutral: '#7c7f93', accents: ['#dc8a78', '#dd7878', '#ea76cb', '#8839ef', '#d20f39', '#e64553', '#fe640b', '#df8e1d', '#40a02b', '#179299', '#04a5e5', '#209fb5', '#1e66f5', '#7287fd'] },
    frappe:    { dark: true,  base: '#303446', neutral: '#838ba7', accents: ['#f2d5cf', '#eebebe', '#f4b8e4', '#ca9ee6', '#e78284', '#ea999c', '#ef9f76', '#e5c890', '#a6d189', '#81c8be', '#99d1db', '#85c1dc', '#8caaee', '#babbf1'] },
    macchiato: { dark: true,  base: '#24273a', neutral: '#8087a2', accents: ['#f4dbd6', '#f0c6c6', '#f5bde6', '#c6a0f6', '#ed8796', '#ee99a0', '#f5a97f', '#eed49f', '#a6da95', '#8bd5ca', '#91d7e3', '#7dc4e4', '#8aadf4', '#b7bdf8'] },
    mocha:     { dark: true,  base: '#1e1e2e', neutral: '#7f849c', accents: ['#f5e0dc', '#f2cdcd', '#f5c2e7', '#cba6f7', '#f38ba8', '#eba0ac', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5', '#89dceb', '#74c7ec', '#89b4fa', '#b4befe'] },
};

// Gmail label colors below this chroma (max channel - min channel, 0..255) are
// treated as "gray" and mapped to the flavor's neutral tone instead of an accent.
const NEUTRAL_CHROMA_THRESHOLD = 30;

function _hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _parseRgb(colorString) {
    const parts = (colorString || '').match(/\d+/g);
    return parts && parts.length >= 3 ? parts.slice(0, 3).map(Number) : null;
}

// Precompute accent RGB triples per flavor.
const _accentRgb = {};
for (const [flavor, data] of Object.entries(FLAVORS)) {
    _accentRgb[flavor] = data.accents.map(_hexToRgb);
}

/**
 * Detect which Catppuccin flavor a themed userstyle is applying, by looking for
 * a flavor's signature base color in the given CSS text (e.g. the concatenated
 * text of the injected Stylus <style> elements). When both a light and a dark
 * flavor are present (the auto light/dark builds), prefersDark chooses between
 * them. Returns a flavor name, or null when no Catppuccin theme is detected.
 */
function detectThemeFlavor(themeCss, prefersDark) {
    if (!themeCss) {
        return null;
    }

    const present = Object.keys(FLAVORS).filter(f => themeCss.includes(FLAVORS[f].base));
    if (present.length === 0) {
        return null;
    }

    const matchingScheme = present.filter(f => FLAVORS[f].dark === !!prefersDark);
    return matchingScheme[0] || present[0];
}

/**
 * Whether a color is "gray" (below the neutral chroma threshold) — i.e. it maps
 * to a flavor's neutral tone rather than an accent. Such bundles need a stronger
 * fill so they don't blend into the theme's background.
 */
function isNeutral(colorString) {
    const rgb = _parseRgb(colorString);
    if (!rgb) {
        return false;
    }
    return (Math.max(...rgb) - Math.min(...rgb)) < NEUTRAL_CHROMA_THRESHOLD;
}

/** The base (background) color of a flavor, as an 'rgb(...)' string. */
function flavorBase(flavor) {
    const data = FLAVORS[flavor];
    if (!data) {
        return null;
    }
    const [r, g, b] = _hexToRgb(data.base);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Snap a color to the given flavor's palette. Near-gray colors map to the
 * flavor's neutral tone; colored ones snap to the nearest accent (squared RGB
 * distance). Returns an 'rgb(...)' string, or the input if it can't be parsed.
 */
function snapToAccent(colorString, flavor) {
    const rgb = _parseRgb(colorString);
    const accents = _accentRgb[flavor];
    if (!rgb || !accents) {
        return colorString;
    }

    const chroma = Math.max(...rgb) - Math.min(...rgb);
    if (chroma < NEUTRAL_CHROMA_THRESHOLD) {
        const [r, g, b] = _hexToRgb(FLAVORS[flavor].neutral);
        return `rgb(${r}, ${g}, ${b})`;
    }

    let best = accents[0];
    let bestDistance = Infinity;
    for (const accent of accents) {
        const distance = (accent[0] - rgb[0]) ** 2
            + (accent[1] - rgb[1]) ** 2
            + (accent[2] - rgb[2]) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = accent;
        }
    }
    return `rgb(${best[0]}, ${best[1]}, ${best[2]})`;
}

export { detectThemeFlavor, flavorBase, snapToAccent, isNeutral, FLAVORS };
