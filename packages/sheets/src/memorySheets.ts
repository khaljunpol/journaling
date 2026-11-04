// In-memory stand-in for the googleapis Sheets client (demo mode). No imports, so tests can load it.
// Each spreadsheet id gets its own sandbox, seeded on first use, dropped when idle or over the limit.

type Seed = (spreadsheetId: string) => Record<string, string[][]> | null;
type Opts = { now?: () => number; idleMs?: number; max?: number };
type Tab = { title: string; sheetId: number; rows: string[][] };
type Sandbox = { tabs: Tab[]; nextSheetId: number; last: number };
type Req = { spreadsheetId?: string | null };
type Values = { values?: unknown[][] | null };
type Request = {
  addSheet?: { properties?: { title?: string | null } | null } | null;
  deleteDimension?: { range?: { sheetId?: number | null; dimension?: string | null; startIndex?: number | null; endIndex?: number | null } | null } | null;
};

function fail(code: number, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function colNum(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

type Parsed = { title: string; c0: number; r0: number; c1: number; r1: number };

// Parses A1 ranges like 'Tab'!A1, 'Tab'!A2:Y and 'Tab'!B5:Y5. Open ends become Infinity.
function parseRange(a1: string): Parsed {
  const m = /^(?:'((?:[^']|'')*)'|([^'!]+))!([A-Za-z]*)(\d*)(?::([A-Za-z]*)(\d*))?$/.exec(a1);
  if (!m) fail(400, 'Unable to parse range');
  const title = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
  const c0 = m[3] ? colNum(m[3].toUpperCase()) : 1;
  const r0 = m[4] ? Number(m[4]) : 1;
  // A lone cell is a 1x1 range.
  if (m[5] === undefined && m[6] === undefined) {
    return { title, c0, r0, c1: m[3] ? c0 : Infinity, r1: m[4] ? r0 : Infinity };
  }
  return { title, c0, r0, c1: m[5] ? colNum(m[5].toUpperCase()) : Infinity, r1: m[6] ? Number(m[6]) : Infinity };
}

const isEmpty = (v: string | undefined) => v === undefined || v === '';

export function createMemorySheets(seed: Seed, opts: Opts = {}) {
  const now = opts.now ?? Date.now;
  const idleMs = opts.idleMs ?? 7_200_000;
  const max = Math.max(1, opts.max ?? 200);
  // Map order is use order: the first key is the least recently used.
  const boxes = new Map<string, Sandbox>();

  // Finds a live sandbox, or reseeds one when it is missing or idle. Unknown ids throw 404.
  function box(id: string | null | undefined): Sandbox {
    const key = String(id ?? '');
    const t = now();
    let b = boxes.get(key);
    if (b && t - b.last > idleMs) { boxes.delete(key); b = undefined; }
    if (!b) {
      const tabs = seed(key);
      if (!tabs) fail(404, 'Requested entity was not found.');
      b = {
        tabs: Object.entries(tabs).map(([title, rows], i) => ({ title, sheetId: i, rows: rows.map((r) => r.map(String)) })),
        nextSheetId: Object.keys(tabs).length,
        last: t,
      };
      while (boxes.size >= max) boxes.delete(boxes.keys().next().value as string);
    } else {
      boxes.delete(key);
    }
    b.last = t;
    boxes.set(key, b);
    return b;
  }

  function tabOf(b: Sandbox, title: string): Tab {
    const tab = b.tabs.find((x) => x.title === title);
    if (!tab) fail(400, `Unable to parse range: ${title}`);
    return tab;
  }

  // Copies of the cells in a range; trailing empty cells and rows are dropped; none gives undefined.
  function read(b: Sandbox, a1: string): string[][] | undefined {
    const p = parseRange(a1);
    const tab = tabOf(b, p.title);
    const out: string[][] = [];
    const lastRow = Math.min(p.r1, tab.rows.length);
    for (let r = p.r0; r <= lastRow; r++) {
      const row = tab.rows[r - 1] ?? [];
      const cells = row.slice(p.c0 - 1, Number.isFinite(p.c1) ? p.c1 : undefined);
      while (cells.length && isEmpty(cells[cells.length - 1])) cells.pop();
      out.push(cells);
    }
    while (out.length && out[out.length - 1].length === 0) out.pop();
    return out.length ? out : undefined;
  }

  // Writes values from a start cell, growing rows as needed. Everything is stored as a string.
  function write(b: Sandbox, title: string, r0: number, c0: number, values: unknown[][]) {
    const tab = tabOf(b, title);
    values.forEach((vals, i) => {
      const r = r0 - 1 + i;
      while (tab.rows.length <= r) tab.rows.push([]);
      const row = tab.rows[r];
      vals.forEach((v, j) => {
        while (row.length < c0 - 1 + j) row.push('');
        row[c0 - 1 + j] = v === null || v === undefined ? '' : String(v);
      });
    });
  }

  // Empties the cells in a range; rows stay in place.
  function blank(b: Sandbox, a1: string) {
    const p = parseRange(a1);
    const tab = tabOf(b, p.title);
    const lastRow = Math.min(p.r1, tab.rows.length);
    for (let r = p.r0; r <= lastRow; r++) {
      const row = tab.rows[r - 1];
      if (!row) continue;
      const last = Math.min(p.c1, row.length);
      for (let c = p.c0; c <= last; c++) row[c - 1] = '';
    }
  }

  function lastUsedRow(tab: Tab): number {
    for (let i = tab.rows.length - 1; i >= 0; i--) if (tab.rows[i].some((v) => !isEmpty(v))) return i + 1;
    return 0;
  }

  return {
    spreadsheets: {
      async get(req: Req & { fields?: string }) {
        const b = box(req.spreadsheetId);
        return { data: { sheets: b.tabs.map((t) => ({ properties: { title: t.title, sheetId: t.sheetId } })) } };
      },
      async batchUpdate(req: Req & { requestBody?: { requests?: Request[] } }) {
        const b = box(req.spreadsheetId);
        for (const r of req.requestBody?.requests ?? []) {
          if (r.addSheet) {
            const title = r.addSheet.properties?.title ?? '';
            if (b.tabs.some((t) => t.title === title)) fail(400, `A sheet with the name "${title}" already exists.`);
            b.tabs.push({ title, sheetId: b.nextSheetId++, rows: [] });
          } else if (r.deleteDimension) {
            const d = r.deleteDimension.range;
            const tab = b.tabs.find((t) => t.sheetId === d?.sheetId);
            if (!tab) fail(400, 'No grid with id');
            if (d?.dimension === 'ROWS') {
              const start = d.startIndex ?? 0;
              tab.rows.splice(start, Math.max(0, (d.endIndex ?? 0) - start));
            }
          }
        }
        return { data: {} };
      },
      values: {
        async get(req: Req & { range?: string | null }) {
          const b = box(req.spreadsheetId);
          return { data: { range: req.range, values: read(b, String(req.range)) } };
        },
        async batchGet(req: Req & { ranges?: string[] | null }) {
          const b = box(req.spreadsheetId);
          return { data: { valueRanges: (req.ranges ?? []).map((r) => ({ range: r, values: read(b, r) })) } };
        },
        // Writes after the last non-empty row of the tab, from the range's first column.
        async append(req: Req & { range?: string | null; valueInputOption?: string; requestBody?: Values }) {
          const b = box(req.spreadsheetId);
          const p = parseRange(String(req.range));
          write(b, p.title, lastUsedRow(tabOf(b, p.title)) + 1, p.c0, req.requestBody?.values ?? []);
          return { data: {} };
        },
        async update(req: Req & { range?: string | null; valueInputOption?: string; requestBody?: Values }) {
          const b = box(req.spreadsheetId);
          const p = parseRange(String(req.range));
          write(b, p.title, p.r0, p.c0, req.requestBody?.values ?? []);
          return { data: {} };
        },
        async batchUpdate(req: Req & { requestBody?: { valueInputOption?: string; data?: Array<{ range?: string | null } & Values> } }) {
          const b = box(req.spreadsheetId);
          for (const d of req.requestBody?.data ?? []) {
            const p = parseRange(String(d.range));
            write(b, p.title, p.r0, p.c0, d.values ?? []);
          }
          return { data: {} };
        },
        async clear(req: Req & { range?: string | null }) {
          blank(box(req.spreadsheetId), String(req.range));
          return { data: {} };
        },
        async batchClear(req: Req & { requestBody?: { ranges?: string[] | null } }) {
          const b = box(req.spreadsheetId);
          for (const r of req.requestBody?.ranges ?? []) blank(b, r);
          return { data: {} };
        },
      },
    },
  };
}
