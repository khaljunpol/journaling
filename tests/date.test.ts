import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { weekdayInitial } from '../lib/date.ts';

describe('date helpers', () => {
  it('returns single-letter weekday initials', () => {
    assert.equal(weekdayInitial(new Date(2026, 5, 22)), 'M');
    assert.equal(weekdayInitial(new Date(2026, 5, 23)), 'T');
    assert.equal(weekdayInitial(new Date(2026, 5, 24)), 'W');
    assert.equal(weekdayInitial(new Date(2026, 5, 25)), 'T');
    assert.equal(weekdayInitial(new Date(2026, 5, 26)), 'F');
    assert.equal(weekdayInitial(new Date(2026, 5, 27)), 'S');
    assert.equal(weekdayInitial(new Date(2026, 5, 28)), 'S');
  });
});
