// Pure helper for the Today sync dot. No imports, so tests can load it.

export type SyncState = 'saved' | 'saving' | 'failed';

/** Failed wins over saving, saving wins over saved. `persistOk` false means the phone could not keep the queue. */
export function syncState(queue: Array<{ state: 'pending' | 'failed' }>, persistOk: boolean): SyncState {
  if (!persistOk || queue.some((q) => q.state === 'failed')) return 'failed';
  if (queue.length > 0) return 'saving';
  return 'saved';
}
