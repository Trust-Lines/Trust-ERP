'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { MyTask, MyTaskStatus } from '@/lib/myWorkspace/taskTypes';
import type { MyApproval } from '@/lib/approvals/mine';
import type { Installation } from '@/lib/installations/compute';
import { getList, type Container, type DashboardAccess, type Loaded } from './dashboardData';

export type OpportunityTotal = number | 'denied' | 'error' | null;

/**
 * Loads the client-side panels. A panel whose source this role can't read is set to 'denied'
 * without calling the API.
 *   My Tasks                GET /api/my-workspace/tasks (status saved like My Tasks does)
 *   PO / PF to sign         GET /api/approvals/mine
 *   Containers              GET /api/containers
 *   Installation            GET /api/installations
 *   Clients opportunity     GET /api/tlines-dashboard/client-opportunities
 */
export function useDashboardData(access: DashboardAccess) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Loaded<MyTask>>(null);
  const [approvals, setApprovals] = useState<Loaded<MyApproval>>(null);
  const [containers, setContainers] = useState<Loaded<Container>>(null);
  const [installs, setInstalls] = useState<Loaded<Installation>>(null);
  const [opportunities, setOpportunities] = useState<OpportunityTotal>(null);

  useEffect(() => {
    void getList('/api/my-workspace/tasks', b => (b.tasks ?? []) as MyTask[]).then(setTasks);
    void getList('/api/approvals/mine', b => (b.approvals ?? []) as MyApproval[]).then(setApprovals);
    if (access.logistics) void getList('/api/containers', b => (b.containers ?? []) as Container[]).then(setContainers); else setContainers('denied');
    if (access.installation) void getList('/api/installations', b => (b.rows ?? []) as Installation[]).then(setInstalls); else setInstalls('denied');
    if (access.opportunities) {
      void fetch('/api/tlines-dashboard/client-opportunities').then(async r => {
        if (r.status === 401 || r.status === 403) return setOpportunities('denied');
        const b = r.ok ? await r.json().catch(() => null) : null;
        setOpportunities(b && typeof b.total === 'number' ? b.total : 'error');
      }).catch(() => setOpportunities('error'));
    } else setOpportunities('denied');
  }, [access.logistics, access.installation, access.opportunities]);

  /** Optimistic done/todo toggle; reverts and toasts on failure. */
  async function toggleTask(t: MyTask, done: boolean) {
    if (!t.statusApi) return;
    const status: MyTaskStatus = done ? 'done' : 'todo';
    const follow = t.statusApi.kind === 'follow_up';
    setTasks(l => (Array.isArray(l) ? l.map(x => (x.id === t.id && x.source === t.source ? { ...x, status } : x)) : l));
    const res = await fetch(t.statusApi.url, {
      method: follow ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: follow ? (done ? 'done' : 'open') : status }),
    }).catch(() => null);
    if (!res?.ok) {
      setTasks(l => (Array.isArray(l) ? l.map(x => (x.id === t.id && x.source === t.source ? { ...x, status: t.status } : x)) : l));
      toast.error('Could not save the status');
      return;
    }
    if (done) toast.success('Task done');
    router.refresh();
  }

  return { tasks, approvals, containers, installs, opportunities, toggleTask };
}
