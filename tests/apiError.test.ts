import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  redact,
  classifyApiError,
  safeMessage,
  apiErrorBody,
  apiErrorStatus,
} from '../lib/server/apiError.ts';

const SHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

describe('redact', () => {
  it('hides a service account address', () => {
    const out = redact('robot@proj.iam.gserviceaccount.com');
    assert.ok(out.includes('[account]'));
    assert.ok(!out.includes('gserviceaccount'));
  });

  it('hides a sheet range and tab name', () => {
    const out = redact("'Logs_Alex'!A2:C");
    assert.ok(out.includes('[range]'));
    assert.ok(!out.includes('Logs_Alex'));
  });

  it('hides a 44-char spreadsheet id', () => {
    assert.equal(SHEET_ID.length, 44);
    const out = redact(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1`);
    assert.ok(out.includes('[id]'));
    assert.ok(!out.includes(SHEET_ID));
  });

  it('leaves harmless text alone', () => {
    assert.equal(redact('connect ETIMEDOUT'), 'connect ETIMEDOUT');
  });
});

describe('classifyApiError', () => {
  it('reads 429 as rate_limit', () => {
    assert.equal(classifyApiError({ code: 429 }), 'rate_limit');
  });

  it('reads a bad range as not_found', () => {
    assert.equal(classifyApiError(new Error('Unable to parse range: Logs!A1')), 'not_found');
  });

  it('reads permission and auth failures', () => {
    assert.equal(classifyApiError(new Error('The caller does not have permission')), 'permission');
    assert.equal(classifyApiError(new Error('Request had insufficient authentication scopes')), 'auth');
  });

  it('reads a dropped connection as upstream', () => {
    assert.equal(classifyApiError(new Error('socket hang up')), 'upstream');
  });

  it('falls back to unknown', () => {
    assert.equal(classifyApiError(new Error('never seen')), 'unknown');
    assert.equal(classifyApiError(null), 'unknown');
  });
});

describe('safeMessage', () => {
  it('has no id, range or account in any message', () => {
    for (const k of ['auth', 'permission', 'not_found', 'rate_limit', 'upstream', 'unknown'] as const) {
      const m = safeMessage(k);
      assert.ok(m.length > 20);
      assert.ok(!/[A-Za-z0-9_-]{30,}/.test(m));
      assert.ok(!m.includes('gserviceaccount'));
    }
  });

  it('tells robot-mode users to share the sheet', () => {
    assert.ok(safeMessage('permission').toLowerCase().includes('share'));
  });
});

describe('apiErrorBody / apiErrorStatus', () => {
  it('never returns the spreadsheet id and has only an error field', () => {
    const original = console.error;
    console.error = () => {};
    try {
      const body = apiErrorBody(new Error(`Requested entity ${SHEET_ID} was not found`), 'test');
      assert.ok(!body.error.includes(SHEET_ID));
      assert.deepEqual(Object.keys(body), ['error']);
    } finally {
      console.error = original;
    }
  });

  it('does not log the spreadsheet id', () => {
    const original = console.error;
    const logged: string[] = [];
    console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    try {
      apiErrorBody(new Error(`bad ${SHEET_ID}`), 'test');
    } finally {
      console.error = original;
    }
    assert.ok(logged.length > 0);
    assert.ok(!logged.join('\n').includes(SHEET_ID));
  });

  it('maps kinds to status codes', () => {
    assert.equal(apiErrorStatus({ code: 403 }), 403);
    assert.equal(apiErrorStatus({ code: 401 }), 401);
    assert.equal(apiErrorStatus({ code: 429 }), 429);
    assert.equal(apiErrorStatus(new Error('x')), 500);
  });
});
