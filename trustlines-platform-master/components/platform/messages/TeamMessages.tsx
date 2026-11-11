import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

// Team messages (was the HR → Messages page; now My Workspace → Messages). The ERP has no
// person-to-person messaging backend yet — no conversations table, API or realtime channel —
// so this shows that plainly instead of a working-looking inbox or a dead "New message" button.
export function TeamMessages() {
  return (
    <section aria-label="Messages" className="grid min-h-[420px] grid-cols-1 overflow-hidden rounded-[8px] border border-ui-divider bg-ui-surface-elevated md:grid-cols-[300px_1fr]">
      <div className="flex flex-col border-b border-ui-divider md:border-b-0 md:border-r">
        <p className="m-0 border-b border-ui-divider px-5 py-4 text-[14px] font-semibold text-ui-heading">Inbox</p>
        <EmptyState size="sm" className="px-5" title="No conversations." />
      </div>
      <EmptyState
        icon={<MessagesSquare />}
        title="Team messaging isn’t connected yet"
        description="Conversations with the team will show here once messaging is added to the ERP. Until then, updates about your work arrive as notifications."
      />
    </section>
  );
}
