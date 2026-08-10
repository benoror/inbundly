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

const NESTED_SEPARATOR = '/';

/**
 * Build a trie of the labels' path segments. Each node is
 * { segment, isLabel, children } where isLabel marks a node at which a label
 * actually ends, and children is an insertion-ordered Map of segment -> node.
 */
function _buildForest(labels) {
    const root = new Map();
    for (const label of labels) {
        let level = root;
        let node = null;
        for (const segment of label.split(NESTED_SEPARATOR)) {
            if (!level.has(segment)) {
                level.set(segment, { segment, isLabel: false, children: new Map() });
            }
            node = level.get(segment);
            level = node.children;
        }
        if (node) {
            node.isLabel = true;
        }
    }
    return root;
}

function _renderNode(node) {
    const children = [...node.children.values()];
    if (children.length === 0) {
        return node.segment;
    }

    const childStrings = children.map(_renderNode);
    if (node.isLabel) {
        // The node is itself a label *and* a parent of others; every one of
        // them is a real label on the thread, so list them as peers.
        return [node.segment, ...childStrings].join(' + ');
    }

    // Pure parent: group its children under it, shown once.
    const inner = childStrings.length === 1
        ? childStrings[0]
        : `(${childStrings.join(', ')})`;
    return `${node.segment}${NESTED_SEPARATOR}${inner}`;
}

/**
 * Present a set of (possibly nested) labels compactly for a combined bundle's
 * title. Any shared parent path is shown once instead of being repeated,
 * grouping is done per shared parent (not just a single global prefix):
 *
 *   ['IH/AI', 'IH/AI/Bender']                   -> 'IH/AI + Bender'
 *   ['IH/AI', 'IH/Kamek', 'IH/Spoint/Bro']      -> 'IH/(AI, Kamek, Spoint/Bro)'
 *   ['Fam/+ale', 'Fam/Contab', 'Fin', 'US/x']   -> 'Fam/(+ale, Contab) + Fin + US/x'
 *   ['Crypto', 'Fin']                           -> 'Crypto + Fin'  (no shared parent)
 */
function formatLabelSetTitle(labels) {
    if (labels.length <= 1) {
        return labels.join(' + ');
    }

    return [..._buildForest(labels).values()].map(_renderNode).join(' + ');
}

//
// Priority bundles
//
// A priority rule captures matching threads into a single bundle, overriding
// the normal per-set grouping. A rule is a list of label patterns (a set); a
// thread must match every pattern to be captured. A pattern ending in '/*'
// matches that label and its whole sub-label subtree (any depth); otherwise it
// matches the label exactly. Matching is case-insensitive.
//

const WILDCARD_SUFFIX = NESTED_SEPARATOR + '*';

/**
 * Does a single label pattern match a thread's label? A trailing '/*' matches
 * the base label itself and anything nested beneath it; otherwise exact match.
 */
function matchLabelPattern(pattern, label) {
    const p = pattern.trim().toLowerCase();
    const l = label.toLowerCase();
    if (p.endsWith(WILDCARD_SUFFIX)) {
        const base = p.slice(0, -WILDCARD_SUFFIX.length);
        return l === base || l.startsWith(base + NESTED_SEPARATOR);
    }
    return l === p;
}

/**
 * Parse priority-bundle lines into rules. Each line is one rule; '+' separates
 * the labels that must all be present (e.g. 'A + B'). Empty parts are dropped.
 */
function parsePriorityRules(lines) {
    return lines
        .map(line => line.split('+').map(s => s.trim()).filter(Boolean))
        .filter(patterns => patterns.length > 0);
}

/** A rule matches a thread when every pattern in it matches some label. */
function ruleMatchesLabels(rule, labels) {
    return rule.every(pattern => labels.some(label => matchLabelPattern(pattern, label)));
}

/** The bundle's identity/display labels for a rule (wildcard suffixes removed). */
function ruleLabels(rule) {
    return rule.map(pattern => pattern.endsWith(WILDCARD_SUFFIX)
        ? pattern.slice(0, -WILDCARD_SUFFIX.length)
        : pattern);
}

export {
    formatLabelSetTitle,
    matchLabelPattern,
    parsePriorityRules,
    ruleMatchesLabels,
    ruleLabels,
};
