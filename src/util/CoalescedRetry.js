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

/**
 * Create a coalesced retry scheduler. Repeated schedule() calls while a timer
 * is pending share one timeout; each fired attempt increments the counter until
 * maxAttempts is reached.
 *
 * @param {function(number): void} fn called with the 1-based attempt number
 * @param {number} delayMs delay before each attempt
 */
function createCoalescedRetry(fn, delayMs) {
    let timer = null;
    let attempts = 0;

    return {
        /**
         * @param {number} maxAttempts
         * @returns {boolean} true if a timer was armed (or already pending)
         */
        schedule(maxAttempts = Infinity) {
            if (timer !== null) {
                return true;
            }
            if (attempts >= maxAttempts) {
                return false;
            }
            timer = setTimeout(() => {
                timer = null;
                attempts += 1;
                fn(attempts);
            }, delayMs);
            return true;
        },

        reset() {
            attempts = 0;
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        },

        get pending() {
            return timer !== null;
        },

        get attempts() {
            return attempts;
        },
    };
}

export { createCoalescedRetry };
