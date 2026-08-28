// lib/supabase/chunkedIn.ts — fixes a real, measured production bug (2026-08-28): once the CRM
// board had enough real data (500+ Opportunities → 400+ distinct Prospect ids), `.in('id', ids)`
// calls with large id arrays started FAILING outright (`TypeError: fetch failed`, ~8s before
// giving up) instead of just being slow. Root cause: PostgREST encodes `.in()` as a query-string
// filter (`?id=in.(uuid1,uuid2,...)`) — with 400+ UUIDs that URL is long enough to blow past a
// length limit somewhere in the request path, so the request itself never completes.
//
// Live-measured fix: splitting the SAME 400 ids into chunks of 100 and running the chunks in
// parallel took 114ms with zero errors, vs. a hard failure for the single unchunked call. This
// helper is the general form of that fix — any `.in(column, ids)` call whose id list can grow
// past a few hundred (a batch-loaded prospect/contact/project/owner list, not a hardcoded handful)
// should go through this instead of calling `.in()` directly.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChunkResult<T> = { data: T[] | null; error: any };

const DEFAULT_CHUNK_SIZE = 150; // ~150 UUIDs per chunk stays comfortably under typical URL length
                                 // limits (150 * 37 chars ≈ 5.5KB, well under the ~8KB ceiling that
                                 // broke the 400-id case) while keeping the chunk count (and thus
                                 // parallel requests) low for normal-sized lists.

/**
 * Runs a `.in(column, ids)`-shaped query in parallel chunks and merges the results, instead of
 * sending one request with a potentially huge id list. `queryChunk` should return whatever the
 * caller's real query returns for that one chunk of ids (same select/order/filters as before —
 * only the `.in()` id list is chunked).
 *
 * Returns the merged rows. Throws (rather than silently swallowing) if ANY chunk errors, since a
 * partial result set masquerading as complete is worse than a loud failure for a board that's
 * meant to reconcile against real Opportunity/Prospect counts.
 */
export async function fetchInChunks<Id, Row>(
  ids: Id[],
  queryChunk: (chunk: Id[]) => PromiseLike<ChunkResult<Row>>,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<Row[]> {
  if (ids.length === 0) return [];
  if (ids.length <= chunkSize) {
    const { data, error } = await queryChunk(ids);
    if (error) throw new Error(typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error));
    return data ?? [];
  }

  const chunks: Id[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

  const results = await Promise.all(chunks.map(c => queryChunk(c)));
  const rows: Row[] = [];
  for (const r of results) {
    if (r.error) throw new Error(typeof r.error === 'object' && r.error && 'message' in r.error ? String((r.error as { message: unknown }).message) : String(r.error));
    if (r.data) rows.push(...r.data);
  }
  return rows;
}
