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

import { createCoalescedRetry } from '../src/util/CoalescedRetry';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

test('coalesces multiple schedule calls into one pending timer', () => {
    const fn = jest.fn();
    const retry = createCoalescedRetry(fn, 50);

    expect(retry.schedule(5)).toBe(true);
    expect(retry.schedule(5)).toBe(true);
    expect(retry.pending).toBe(true);

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(retry.attempts).toBe(1);
    expect(retry.pending).toBe(false);
});

test('stops scheduling once maxAttempts is reached', () => {
    const fn = jest.fn();
    const retry = createCoalescedRetry(fn, 10);

    retry.schedule(2);
    jest.advanceTimersByTime(10);
    retry.schedule(2);
    jest.advanceTimersByTime(10);
    expect(fn).toHaveBeenCalledTimes(2);

    expect(retry.schedule(2)).toBe(false);
    jest.advanceTimersByTime(10);
    expect(fn).toHaveBeenCalledTimes(2);
});

test('reset clears pending timer and attempt count', () => {
    const fn = jest.fn();
    const retry = createCoalescedRetry(fn, 50);

    retry.schedule(5);
    retry.reset();
    expect(retry.pending).toBe(false);
    expect(retry.attempts).toBe(0);

    jest.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    retry.schedule(5);
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith(1);
});
