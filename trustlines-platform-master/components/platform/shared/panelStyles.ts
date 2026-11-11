import { cn } from '@/lib/utils';

// Platform panel look (same tokens as the project subpage cards). Used by TaskList and ActivityFeed.
export const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const PANEL = 'flex min-w-0 flex-col rounded-[8px] border border-ui-divider bg-ui-page-bg';
export const PANEL_HEAD = 'border-b border-ui-divider px-4 py-3';
export const PANEL_TITLE = cn('m-0 text-[16px] font-semibold leading-[1.4]', HEADING);
export const FIELD = 'h-10 w-full min-w-0 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[13px] text-[var(--color-secondary-700)] outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:text-ui-heading';
