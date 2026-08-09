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

import DomUtils from '../util/DomUtils';
import { LABEL_SET_SEPARATOR } from '../util/Constants';
import { matchLabelPattern, parsePriorityRules, ruleMatchesLabels, ruleLabels } from '../util/LabelSet';

/**
 * Identifies the labels that have bundling enabled, according to the user's options.
 * By default, all labels are bundled.
 *
 * The include/exclude list matches labels case-insensitively. Each entry is a
 * pattern: a plain label matches exactly, while a trailing '/*' matches that
 * label and its whole sub-label subtree (any depth) — e.g. 'Newsletters/*'.
 */
class SelectiveBundling {
    /**
     * @param customBundles optional CustomBundles instance. When present, a
     *   message's membership in a user-defined custom bundle overrides all
     *   label-based grouping.
     */
    constructor(customBundles = null) {
        this.customBundles = customBundles;
        // Defaults mirror OPTION_DEFAULTS / the options page; sync overlay follows.
        this.exclude = true;
        this.labels = [];
        this.combineLabels = true;
        this.priorityRules = [];
        this.optionsReady = new Promise(resolve => {
            chrome.storage.sync.get(
                {
                    exclude: true,
                    labels: [],
                    combineLabels: true,
                    priorityBundles: [],
                },
                options => {
                    this.applyOptions(options);
                    resolve();
                });
        });
    }

    /**
     * Update bundling rules from chrome.storage.sync values (initial load or
     * a cross-device sync). Only keys present on `options` are applied; omitted
     * keys keep their current values.
     */
    applyOptions(options = {}) {
        if ('exclude' in options) {
            this.exclude = !!options.exclude;
        }
        if ('labels' in options) {
            this.labels = (options.labels || []).map(s => s.trim()).filter(Boolean);
        }
        if ('combineLabels' in options) {
            this.combineLabels = !!options.combineLabels;
        }
        if ('priorityBundles' in options) {
            this.priorityRules = parsePriorityRules(options.priorityBundles || []);
        }
    }

    /**
     * Returns the bundle key(s) a message belongs to. Normally this is the list
     * of its bundling-enabled labels (one bundle per label). When combineLabels
     * is on, the whole set of labels is joined into a single key, so a distinct
     * combination of labels forms its own bundle.
     *
     * A custom bundle takes precedence over everything: if the message's thread
     * has been placed in a user-defined custom bundle, that bundle is its sole
     * bundle, overriding priority rules, the include/exclude gate, and grouping.
     *
     * Priority rules come next: if the message matches one (checked top to
     * bottom, first match wins), that rule becomes its sole bundle, overriding
     * both the include/exclude gate and set-grouping. This lets specific labels
     * (or label sets) always group together, regardless of other labels present.
     */
    findRelevantLabels(message) {
        if (this.customBundles) {
            const customKey = this.customBundles.keyForThread(DomUtils.getThreadId(message));
            if (customKey) {
                return [customKey];
            }
        }

        const messageLabels = DomUtils.getLabelStrings(message);

        for (const rule of this.priorityRules) {
            if (ruleMatchesLabels(rule, messageLabels)) {
                return [ruleLabels(rule).join(LABEL_SET_SEPARATOR)];
            }
        }

        const inList = l => this.labels.some(pattern => matchLabelPattern(pattern, l));
        const relevant = this.exclude
            ? messageLabels.filter(l => !inList(l))
            : messageLabels.filter(l => inList(l));

        if (this.combineLabels) {
            return relevant.length ? [relevant.join(LABEL_SET_SEPARATOR)] : [];
        }
        return relevant;
    }
}

export default SelectiveBundling;