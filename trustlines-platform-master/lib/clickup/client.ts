
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

async function clickupGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const token = requireToken();
  const url = new URL(`${CLICKUP_API_BASE}${path}`);
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

export interface ClickUpCommentBlock {
  text?: string;
  type?: string;
  bookmark?: { url: string; id?: string; title?: string; thumbnail_url?: string };
}
export interface ClickUpComment {
  id: string; comment_text: string; comment?: ClickUpCommentBlock[]; date: string;
  user: { username: string } | null;
}

export async function getTaskComments(taskId: string): Promise<ClickUpComment[]> {
  const data = await clickupGet<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`);
  return data.comments ?? [];
}
