'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ItTicketDetailView, type ItTicketDetailData } from './ItTicketDetail';

// Figma "IT Tickets" dark (862:48081): the ticket opens as a 1268px panel centred over the list,
// behind a 70% black "Drawer scrim" (862:48357). Same dialog shell as the HR request detail.
// The URL owns the open state: Escape, a scrim click or the X all go back to the list.
export function ItTicketDetailModal({ ticket, closeHref = '/it/tickets', canResolve = false }: {
  ticket: ItTicketDetailData | null;
  closeHref?: string;
  canResolve?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={open => {
        if (!open) router.push(closeHref);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          aria-labelledby={titleId}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1268px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[11px] bg-ui-page-bg p-5 font-ui shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 sm:p-8"
        >
          <ItTicketDetailView ticket={ticket} titleId={titleId} closeHref={closeHref} canResolve={canResolve} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
