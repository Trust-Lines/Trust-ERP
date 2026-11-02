import { cn } from '@/lib/utils';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

/** Filter tabs with counts, shared by the Website hub's Projects, Blog and Web Leads lists. */
export function CategoryViews({ options, value, onChange, label = 'Category', className }: {
  options: { value: string; label: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap gap-2 border-b border-ui-divider pb-3', className)}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-[38px] items-center gap-2 rounded-[6px] border-0 px-4 text-[13px] transition-colors',
              active ? 'bg-ui-selected-bg font-semibold' : 'bg-ui-page-bg font-medium hover:bg-ui-hover-bg',
              HEADING,
            )}
          >
            {o.label}
            <span className="text-[12px] font-normal leading-[1.4] text-ui-text-secondary">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
