// Server → open browsers, without a table: Supabase Realtime broadcast over its REST endpoint.
// Used to tell a page "this Dropbox folder changed, reload it" (lib/dropbox/autoSync.ts). The
// message carries no data, only the fact — the page re-reads through its own authorized route.

export const dropboxProjectTopic = (projectId: string) => `dropbox-project-${projectId}`;
export const dropboxDesignTopic = (jobId: string) => `dropbox-design-${jobId}`;
export const DROPBOX_CHANGED = 'changed';

/** Best effort: a failed broadcast never breaks the caller. */
export async function broadcast(topics: string[], event = DROPBOX_CHANGED): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!topics.length || !url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: topics.map(topic => ({ topic, event, payload: { at: Date.now() }, private: false })) }),
    });
  } catch (e) {
    console.error('[broadcast]', e instanceof Error ? e.message : e);
  }
}
