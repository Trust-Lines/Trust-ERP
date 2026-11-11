import { redirect } from 'next/navigation';

// HR "Messages" was personal — now My Workspace → Messages (2026-11-11).
export default function Page() {
  redirect('/workspace/messages');
}
