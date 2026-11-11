import { redirect } from 'next/navigation';

// "My meetings" moved to My Workspace → Calendar & Meetings (2026-11-11).
export default function Page() {
  redirect('/workspace/calendar');
}
