// One-time helper: rename `<Base>_<account>` tabs to plain `<Base>` tabs.
// Never deletes or clears anything. Renames only with --apply.
// Run: node --env-file=.env.local --experimental-strip-types scripts/rename-tabs.ts <spreadsheetId> [--account <name>] [--apply]
import { google } from 'googleapis';
import { findAccountSets, planTabRename } from '../lib/tabRename.ts';
import { range } from '../lib/sheetLayout.ts';

const USAGE = 'Usage: node --env-file=.env.local --experimental-strip-types scripts/rename-tabs.ts <spreadsheetId> [--account <name>] [--apply]';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const accountIdx = args.indexOf('--account');
const account = accountIdx >= 0 ? args[accountIdx + 1] : undefined;
const spreadsheetId = args[0] && !args[0].startsWith('--') ? args[0] : undefined;

async function main() {
  if (!spreadsheetId || (accountIdx >= 0 && (!account || account.startsWith('--'))) || (apply && !account)) {
    console.log(USAGE);
    process.exit(1);
  }
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const props = (meta.data.sheets || []).map((s) => s.properties!).filter(Boolean);
  const titles = props.map((p) => String(p.title));

  if (!account) {
    for (const set of findAccountSets(titles)) {
      console.log(`Account "${set.account}":`);
      for (const tab of set.tabs) {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(tab, 'A:A') });
        const rows = Math.max(0, (res.data.values?.length ?? 0) - 1);
        console.log(`  ${tab}: ${rows} rows`);
      }
    }
    return;
  }

  const plan = planTabRename(titles, account);
  for (const r of plan.renames) console.log(`rename ${r.from} -> ${r.to}`);
  for (const s of plan.skipped) console.log(`skip ${s.from} (${s.reason})`);
  if (!plan.renames.length) { console.log('Nothing to rename.'); return; }
  if (!apply) { console.log('Dry run. Add --apply to rename.'); return; }

  const requests = plan.renames.map((r) => ({
    updateSheetProperties: {
      properties: { sheetId: props.find((p) => p.title === r.from)!.sheetId, title: r.to },
      fields: 'title',
    },
  }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  console.log(`Renamed ${requests.length} tabs.`);
}

main().catch((e: unknown) => {
  console.error('Failed:', e instanceof Error ? e.message : 'unknown error');
  process.exit(1);
});
