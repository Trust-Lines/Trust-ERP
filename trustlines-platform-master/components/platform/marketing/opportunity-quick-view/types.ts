import type { LeadTiming } from '@/types/database';

// Shapes the opportunity / potential quick view loads.

export type Deal = Record<string, unknown>;
export interface ProspectInfo { display_name: string; industry: string | null; brand_name: string | null }
export interface ContactOption { id: string; name: string }
export interface ProjectInfo { code: string; dropbox_root_path: string | null }
// Timing/has_active_project/etc. only ever live on the linked Need — never copied onto the
// Opportunity/Potential row itself (no columns there) — fetched read-only for display.
export interface NeedInfo { timing: LeadTiming | null; has_active_project: boolean | null; expected_start_date: string | null; layout_available: boolean | null }
export interface NeedNote {
  id: string; author_name: string | null; author_id?: string | null; body: string;
  image_path: string | null; link_url: string | null; link_title: string | null; link_thumbnail_url: string | null;
  source_created_at: string | null; created_at: string; external_source?: string | null;
}
export interface NeedFile { id: string; dropbox_path: string; file_name: string; uploaded_by: string | null; uploaded_by_name: string | null; created_at: string }
export interface Tag { name: string; color: string }
// A file in flight (or one that failed) — finished uploads move into `files`.
export interface UploadItem { key: string; name: string; size: number; error?: string }
