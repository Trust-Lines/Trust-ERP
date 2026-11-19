import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HEADING } from '../designShared';

export type TabKey = 'brief' | 'notes' | 'files' | 'versions' | 'materials' | 'activity';
export interface Note { id: string; author_id: string | null; author_name: string | null; body: string; created_at: string }
export interface Activity { id: string; actor_name: string; kind: string; body: string | null; created_at: string }
export type FileSource = 'design' | 'intake';

export const FILE_CATEGORY_LABELS: Record<string, string> = {
  plan_layout: 'Plan / Layout', photos: 'Photos', areas_note: 'Areas note', client_special_request_note: 'Special request',
  shelving_note: 'Shelving note', millwork_note: 'Millwork note', image_note: 'Image note', ceiling_note: 'Ceiling note',
};
export const cap = (s: string) => s.replace(/_/g, ' ');
export const toISODate = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
export const parseISODate = (s: string | null) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

// Figma "Design Workspace" job pop-up (node 499:6209).
/** Status chip: 12px label, 14px icon, 4px radius. */
export const CHIP = 'h-[22px] gap-1 rounded-[4px] pl-2 pr-2.5 text-[12px] leading-4 [&_svg]:size-3.5';
/** General Info inputs: 42px, white fill, 6px radius, 14px semibold. */
export const INPUT_CLS = 'h-[42px] rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[14px] font-semibold tracking-[-0.308px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading';
/** Underline tabs: 48px row, 3px active border. */
export const TAB_CLS = 'h-full min-w-0 shrink-0 border-b-[3px] border-transparent bg-transparent px-0 text-[13px] leading-[1.4] text-ui-text-secondary hover:bg-transparent hover:text-[var(--color-secondary-700)] dark:bg-transparent dark:hover:bg-transparent dark:hover:text-ui-heading data-active:border-[var(--color-secondary-700)] data-active:text-[13px] data-active:font-semibold data-active:text-[var(--color-secondary-700)] dark:data-active:border-ui-heading dark:data-active:text-ui-heading';

export function ReadOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('flex h-[42px] items-center rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[14px] font-semibold', HEADING, className)}>{children}</span>;
}

/** White card: 16px title, divider, then content. */
export function Card({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-page-bg px-3.5 pt-3.5 pb-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>{title}</h3>
          {action}
        </div>
        <hr className="m-0 border-0 border-t border-ui-divider" />
      </div>
      {children}
    </section>
  );
}
