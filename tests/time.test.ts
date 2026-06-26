import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTimeEntry } from '../lib/time.ts';

describe('time entry validation', () => {
  it('accepts timestamp-style category IDs created by custom time categories', () => {
    assert.deepEqual(parseTimeEntry({ hour: '9', category: '1760000000000' }), {
      ok: true,
      entry: { hour: 9, category: 1760000000000 },
    });
  });

  it('rejects invalid hours and negative categories', () => {
    assert.deepEqual(parseTimeEntry({ hour: '24', category: '1' }), {
      ok: false,
      message: 'hour must be 0..23',
    });
    assert.deepEqual(parseTimeEntry({ hour: '10', category: '-1' }), {
      ok: false,
      message: 'category must be a non-negative integer',
    });
  });
});
