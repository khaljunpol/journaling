// One request shared by every caller for `ttl` ms. A failed request is not kept, so the next call tries again.
export function shared<T>(fn: () => Promise<T>, ttl: number, now: () => number = Date.now): () => Promise<T> {
  let last: { at: number; p: Promise<T> } | null = null;
  return () => {
    if (last && now() - last.at < ttl) return last.p;
    const p = fn();
    const entry = { at: now(), p };
    last = entry;
    p.catch(() => { if (last === entry) last = null; });
    return p;
  };
}
