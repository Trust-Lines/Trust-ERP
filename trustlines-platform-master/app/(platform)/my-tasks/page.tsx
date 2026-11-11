import { redirect } from 'next/navigation';

// My Tasks moved to My Workspace (2026-11-11); old links keep working.
export default function Page() {
  redirect('/workspace/tasks');
}
