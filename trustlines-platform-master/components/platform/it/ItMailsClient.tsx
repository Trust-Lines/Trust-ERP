'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { PurelymailMailboxes } from './PurelymailMailboxes';

// IT → Mails: the company mailboxes, straight from the mail host (Purelymail) — list, open a new
// mailbox, change passwords (edit.it, like the API). "New Email" opens Purelymail's New mailbox.

export function ItMailsClient({ canEditMailboxes = false }: {
  /** edit.it: open Purelymail mailboxes and change their passwords. */
  canEditMailboxes?: boolean;
}) {
  // 'New Email' opens Purelymail's New mailbox (below) — bumping this asks it to.
  const [newMailbox, setNewMailbox] = useState(0);

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <PageHeading
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Mails', href: '/it/mails' }]}
        title="Mails"
        subtitle="Company mailboxes"
        bodyClassName="gap-2"
        actions={
          <button
            type="button"
            disabled={!canEditMailboxes}
            onClick={() => setNewMailbox(n => n + 1)}
            title={canEditMailboxes ? undefined : 'Opening mailboxes needs IT edit rights'}
            className="flex h-9 items-center gap-2 rounded-md bg-accent-400 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            New Email
          </button>
        }
      />

      <PurelymailMailboxes canEdit={canEditMailboxes} openNew={newMailbox} />
    </div>
  );
}
