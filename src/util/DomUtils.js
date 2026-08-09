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

import { 
    GmailClasses, 
    Selectors,
} from './Constants';

const DomUtils = {
    findMessageRow: function(messageRowDescendant) {
        return messageRowDescendant.closest('tr');
    },

    extractDate: function(message) {
        var node = message.querySelector(Selectors.MESSAGE_DATE)
        return node ? node.title : null
    },

    isChecked: function(checkboxNode) {
        return checkboxNode.getAttribute('aria-checked') === 'true';
    },

    /**
     * True for Gmail date tooltip strings (e.g. "Fri, Aug 7, 2026, 9:51 AM"),
     * which sometimes sit near label chips and must not be treated as labels.
     */
    _looksLikeDateTitle: function(value) {
        return /\b20\d{2}\b/.test(value) && (value.includes(',') || value.includes(':'));
    },

    /**
     * Pick the best human label name from candidate strings. Prefer nested
     * paths (contain `/`) over leaf chip text, then the longest remaining name.
     */
    _bestLabelCandidate: function(candidates) {
        const clean = value => (value || '').trim();
        const pool = candidates
            .map(clean)
            .filter(Boolean)
            .filter(value => !DomUtils._looksLikeDateTitle(value));
        if (!pool.length) {
            return '';
        }
        return pool.sort((a, b) => {
            const bySlash = Number(b.includes('/')) - Number(a.includes('/'));
            return bySlash !== 0 ? bySlash : b.length - a.length;
        })[0];
    },

    /**
     * Collect attribute-based name candidates from an element.
     */
    _labelAttrCandidates: function(el) {
        if (!el || !el.getAttribute) {
            return [];
        }
        return [
            el.getAttribute('title'),
            el.getAttribute('aria-label'),
            el.getAttribute('data-tooltip'),
            el.getAttribute('data-name'),
        ];
    },

    /**
     * Read the human label name from a Gmail label chip (`.ar.as .at`).
     * Newer Gmail builds often leave `.at[title]` empty and put the full path on
     * a container/sibling/descendant attribute, while `.av` only shows a leaf.
     */
    getLabelName: function(chip) {
        if (!chip) {
            return '';
        }

        const clean = value => (value || '').trim();
        const container = chip.closest(Selectors.LABEL_CONTAINERS) || chip;
        const candidates = [];

        candidates.push(...DomUtils._labelAttrCandidates(chip));
        candidates.push(...DomUtils._labelAttrCandidates(container));

        for (const el of container.querySelectorAll(
            '[title], [aria-label], [data-tooltip], [data-name]')) {
            candidates.push(...DomUtils._labelAttrCandidates(el));
        }

        // Tooltip nodes are sometimes siblings of the chip container.
        const parent = container.parentElement;
        if (parent) {
            for (const el of parent.children) {
                candidates.push(...DomUtils._labelAttrCandidates(el));
            }
        }

        const fromAttrs = DomUtils._bestLabelCandidate(candidates);
        if (fromAttrs) {
            return fromAttrs;
        }

        const av = chip.querySelector('.av');
        return clean(av && av.textContent) || clean(chip.textContent);
    },

    getLabelStrings: function(message) {
        const chips = [...message.querySelectorAll(Selectors.LABELS)];
        const fromChips = chips
            .map(chip => DomUtils.getLabelName(chip))
            .filter(Boolean);
        if (fromChips.length) {
            return fromChips;
        }

        // No `.at` chips resolved — try each label container directly.
        return [...message.querySelectorAll(Selectors.LABEL_CONTAINERS)]
            .map(container => DomUtils.getLabelName(container))
            .filter(Boolean);
    },

    /**
     * Read Gmail's stable thread id for a message row, or null if absent
     * (e.g. inboxy's own injected bundle rows carry no thread id). This id is
     * durable across reloads, so it's used to persist custom bundle membership.
     */
    getThreadId: function(message) {
        const node = message.querySelector(Selectors.THREAD_ID);
        return node ? node.getAttribute('data-legacy-thread-id') : null;
    },

    /**
     * Read the color that Gmail assigns to a label, by inspecting the label chip
     * matching labelTitle within the given message row.
     *
     * Returns { background, color } with the chip's inline colors, or null when
     * the label has no custom color (or the chip can't be found). Reading Gmail's
     * own inline colors keeps bundles consistent with the current Gmail theme.
     */
    getLabelColors: function(message, labelTitle) {
        const chip = [...message.querySelectorAll(Selectors.LABELS)]
            .find(l => DomUtils.getLabelName(l) === labelTitle);
        if (!chip) {
            return null;
        }

        const container = chip.closest(Selectors.LABEL_CONTAINERS) || chip;
        let background = null;
        let color = null;
        for (const el of [container, ...container.querySelectorAll('*')]) {
            const style = el.style;
            if (!style) {
                continue;
            }
            if (!background && style.backgroundColor) {
                background = style.backgroundColor;
            }
            if (!color && style.color) {
                color = style.color;
            }
        }

        return background ? { background, color } : null;
    },

    /**
     * Pick the label color that reads best as text/accent on a neutral row:
     * the darker of the label's two colors for a light theme, the lighter for a
     * dark theme. This keeps the label's hue while staying legible (a label's
     * own text color can be white, which would vanish on a white row).
     */
    pickAccentColor: function(colors, isDarkTheme) {
        const candidates = [colors.background, colors.color].filter(Boolean);
        if (!candidates.length) {
            return null;
        }

        const brightness = c => {
            const parts = (c.match(/\d+/g) || []).map(Number);
            if (parts.length < 3) {
                return 128;
            }
            const [r, g, b] = parts;
            return (0.299 * r) + (0.587 * g) + (0.114 * b);
        };

        return candidates.sort((a, b) => isDarkTheme
            ? brightness(b) - brightness(a)
            : brightness(a) - brightness(b))[0];
    },

    htmlToElement: function(html) {
        var template = document.createElement('template');
        html = html.trim();
        template.innerHTML = html;
        return template.content.firstChild;
    }
}

export default DomUtils;