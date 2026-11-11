import { redirect } from 'next/navigation';

// HR "My work" was the personal task feed — now My Workspace → My Tasks (2026-11-11).
export default function Page() {
  redirect('/workspace/tasks');
}
