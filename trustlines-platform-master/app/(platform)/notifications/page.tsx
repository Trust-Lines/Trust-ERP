import { redirect } from 'next/navigation';

// Notifications moved to My Workspace (2026-11-11); e-mails and stored notification links still use this URL.
export default function Page() {
  redirect('/workspace/notifications');
}
