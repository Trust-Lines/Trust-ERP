export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string;
  project_id: string | null;
  project: { code: string; name: string } | null;
}

export type NotificationTab = 'all' | 'unread';

export interface NotificationGroup {
  day: number;
  rows: NotificationRow[];
}
