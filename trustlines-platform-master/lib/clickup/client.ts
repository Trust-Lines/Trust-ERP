
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

export class ClickUpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function requireToken(): string {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new ClickUpError('CLICKUP_API_TOKEN is not set — add it to .env.local first.', 500);
  return token;
}

const CLICKUP_API_V3 = 'https://api.clickup.com/api/v3';

async function clickupGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>, base: string = CLICKUP_API_BASE): Promise<T> {
  const token = requireToken();
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ClickUpError(`ClickUp API ${res.status} on GET ${path}: ${body.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface ClickUpTeam { id: string; name: string; }
export interface ClickUpSpace { id: string; name: string; }
export interface ClickUpFolder { id: string; name: string; lists: ClickUpListSummary[]; }
export interface ClickUpListSummary { id: string; name: string; }
export interface ClickUpCustomFieldOption { id: string; name?: string; label?: string; }
export interface ClickUpCustomField {
  id: string; name: string; type: string;
  type_config?: { options?: ClickUpCustomFieldOption[] };
}
export interface ClickUpList { id: string; name: string; }
export interface ClickUpTaskCustomFieldValue {
  id: string; name: string; type: string; value: unknown;
  type_config?: { options?: ClickUpCustomFieldOption[] };
}
export interface ClickUpTag { name: string; tag_bg: string; tag_fg: string; }

export interface ClickUpTask {
  id: string; name: string; description: string | null; text_content?: string | null; status: { status: string };
  date_created: string; date_updated: string;
  due_date?: string | null;
  date_done?: string | null;
  custom_fields: ClickUpTaskCustomFieldValue[];
  tags?: ClickUpTag[];
  custom_item_id?: number | null;
  parent?: string | null;
  url: string;
}

export function resolveCustomFieldValue(cf: ClickUpTaskCustomFieldValue): unknown {
  const options = cf.type_config?.options;
  if (!options) return cf.value;
  const nameOf = (o: ClickUpCustomFieldOption) => o.name ?? o.label ?? o.id;
  if (cf.type === 'drop_down' && typeof cf.value === 'number') return nameOf(options[cf.value]) ?? cf.value;
  if (cf.type === 'labels' && Array.isArray(cf.value)) {
    return cf.value.map(id => nameOf(options.find(o => o.id === id) ?? { id: String(id) }));
  }
  return cf.value;
}

export async function getAuthorizedTeams(): Promise<ClickUpTeam[]> {
  const data = await clickupGet<{ teams: ClickUpTeam[] }>('/team');
  return data.teams;
}

export async function getSpaces(teamId: string): Promise<ClickUpSpace[]> {
  const data = await clickupGet<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`, { archived: false });
  return data.spaces;
}

export async function getFolders(spaceId: string): Promise<ClickUpFolder[]> {
  const data = await clickupGet<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, { archived: false });
  return data.folders;
}

export async function getFolderlessLists(spaceId: string): Promise<ClickUpListSummary[]> {
  const data = await clickupGet<{ lists: ClickUpListSummary[] }>(`/space/${spaceId}/list`, { archived: false });
  return data.lists;
}

export async function getFolder(folderId: string): Promise<ClickUpFolder> {
  return clickupGet<ClickUpFolder>(`/folder/${folderId}`);
}

export async function getList(listId: string): Promise<ClickUpList> {
  return clickupGet<ClickUpList>(`/list/${listId}`);
}

export interface ClickUpView {
  id: string; name: string;
  parent: { id: string; type: number } | null;
}

export async function getView(viewId: string): Promise<ClickUpView> {
  const data = await clickupGet<{ view?: ClickUpView } & ClickUpView>(`/view/${viewId}`);
  return data.view ?? data;
}

export async function getViewTasks(viewId: string, page = 0): Promise<{ tasks: ClickUpTask[]; hasMore: boolean }> {
  const data = await clickupGet<{ tasks: ClickUpTask[]; last_page: boolean }>(`/view/${viewId}/task`, { page, subtasks: true });
  return { tasks: data.tasks, hasMore: !data.last_page };
}

export async function getAllViewTasks(viewId: string): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = [];
  let page = 0;
  for (;;) {
    const { tasks, hasMore } = await getViewTasks(viewId, page);
    all.push(...tasks);
    if (!hasMore || tasks.length === 0) break;
    page += 1;
  }
  return all;
}

export async function getListCustomFields(listId: string): Promise<ClickUpCustomField[]> {
  const data = await clickupGet<{ fields: ClickUpCustomField[] }>(`/list/${listId}/field`);
  return data.fields;
}

export async function getListTasks(listId: string, page = 0): Promise<{ tasks: ClickUpTask[]; hasMore: boolean }> {
  const data = await clickupGet<{ tasks: ClickUpTask[]; last_page: boolean }>(`/list/${listId}/task`, {
    page, include_closed: true, subtasks: true,
  });
  return { tasks: data.tasks, hasMore: !data.last_page };
}

export async function getAllListTasks(listId: string): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = [];
  let page = 0;
  for (;;) {
    const { tasks, hasMore } = await getListTasks(listId, page);
    all.push(...tasks);
    if (!hasMore || tasks.length === 0) break;
    page += 1;
  }
  return all;
}

export interface ClickUpChecklistItem { id: string; name: string; resolved: boolean; orderindex: number; }
export interface ClickUpChecklist { id: string; name: string; items: ClickUpChecklistItem[]; }

export async function getTaskChecklists(taskId: string): Promise<ClickUpChecklist[]> {
  const data = await clickupGet<{ checklists?: ClickUpChecklist[] }>(`/task/${taskId}`);
  return data.checklists ?? [];
}

export interface ClickUpAttachment {
  id: string; title?: string; extension?: string; mimetype?: string; size?: number; url?: string; date?: string;
}
export interface ClickUpCommentBlock {
  text?: string;
  type?: string;
  bookmark?: { url: string; id?: string; title?: string; thumbnail_url?: string };
  attachment?: ClickUpAttachment;
  image?: { url?: string };
}
export interface ClickUpComment {
  id: string; comment_text: string; comment?: ClickUpCommentBlock[]; date: string;
  user: { username: string } | null;
  reply_count?: number | string;
}

// ClickUp returns at most 25 comments per call, newest first — page with start/start_id.
export async function getTaskComments(taskId: string): Promise<ClickUpComment[]> {
  const all: ClickUpComment[] = [];
  const seen = new Set<string>();
  let params: Record<string, string> | undefined;
  for (let i = 0; i < 40; i++) {
    const data = await clickupGet<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`, params);
    const batch = (data.comments ?? []).filter(c => !seen.has(c.id));
    batch.forEach(c => seen.add(c.id));
    all.push(...batch);
    if ((data.comments ?? []).length < 25 || batch.length === 0) break;
    const last = data.comments[data.comments.length - 1];
    params = { start: last.date, start_id: last.id };
  }
  return all;
}

export async function getCommentReplies(commentId: string): Promise<ClickUpComment[]> {
  const data = await clickupGet<{ comments: ClickUpComment[] }>(`/comment/${commentId}/reply`);
  return data.comments ?? [];
}

export async function getTaskAttachments(taskId: string): Promise<ClickUpAttachment[]> {
  const data = await clickupGet<{ attachments?: ClickUpAttachment[] }>(`/task/${taskId}`);
  return data.attachments ?? [];
}

// ── Docs (API v3) — read-only ────────────────────────────────────────────────────────────
export interface ClickUpDoc {
  id: string; name: string; date_created: number; date_updated: number;
  parent?: { id: string; type: number } | null; deleted?: boolean;
}
export interface ClickUpDocPage {
  id: string; doc_id?: string; name: string; sub_title?: string | null;
  date_created?: number; date_updated?: number; content?: string; pages?: ClickUpDocPage[];
}

/** Every Doc in the workspace (paged by cursor). */
export async function getAllDocs(workspaceId: string): Promise<ClickUpDoc[]> {
  const all: ClickUpDoc[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 200; i++) {
    const data = await clickupGet<{ docs: ClickUpDoc[]; next_cursor?: string }>(`/workspaces/${workspaceId}/docs`, { limit: 100, cursor }, CLICKUP_API_V3);
    all.push(...(data.docs ?? []));
    cursor = data.next_cursor;
    if (!cursor || !(data.docs ?? []).length) break;
  }
  return all;
}

/** A Doc's pages as Markdown, flattened (sub-pages included, in reading order). */
export async function getDocPages(workspaceId: string, docId: string): Promise<ClickUpDocPage[]> {
  const pages = await clickupGet<ClickUpDocPage[]>(`/workspaces/${workspaceId}/docs/${docId}/pages`, { content_format: 'text/md', max_page_depth: -1 }, CLICKUP_API_V3);
  const out: ClickUpDocPage[] = [];
  const walk = (ps: ClickUpDocPage[]) => { for (const pg of ps ?? []) { out.push(pg); if (pg.pages?.length) walk(pg.pages); } };
  walk(Array.isArray(pages) ? pages : []);
  return out;
}

/** Just enough of a task to find out which task it is nested under. */
export async function getTaskBasic(taskId: string): Promise<{ id: string; name: string; parent?: string | null }> {
  return clickupGet(`/task/${taskId}`);
}
