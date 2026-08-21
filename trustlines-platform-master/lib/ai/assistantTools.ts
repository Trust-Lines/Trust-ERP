import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function admin(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface AiCtx {
  role: string;
  pmClientId: string | null;
}

async function maps(sb: ReturnType<typeof admin>) {
  const [clients, companies, people, vendors] = await Promise.all([
    sb.from('clients').select('id, name, code'),
    sb.from('client_companies').select('id, name, code, margin_pct, client_id'),
    sb.from('profiles').select('id, full_name, role, is_pm_supervisor, pm_client_id, is_active'),
    sb.from('suppliers').select('id, name, code, country'),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = (rows: any[] | null): Record<string, any> =>
    Object.fromEntries((rows ?? []).map((r: { id: string }) => [r.id, r]));
  return {
    clients:   byId(clients.data),
    companies: byId(companies.data),
    people:    byId(people.data),
    vendors:   byId(vendors.data),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clientList: (clients.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    companyList: (companies.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peopleList: (people.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vendorList: (vendors.data ?? []) as any[],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const name = (m: any, id: string | null) => (id && m[id]?.full_name) || null;

export const ASSISTANT_TOOLS = [
  {
    name: 'list_projects',
    description:
      'List projects with key facts (code, name, stage, phase, client/region, service, PMs, deal value, delivery dates). ' +
      'Use for "which projects…", counts, filtering by stage or searching by code/name. Returns up to `limit` rows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Match against project code or name (case-insensitive).' },
        stage:  { type: 'string', description: 'Filter by current_stage (e.g. finalization, construction, production, delivery).' },
        include_archived: { type: 'boolean', description: 'Include archived/deleted projects (default false).' },
        limit:  { type: 'number', description: 'Max rows (default 50).' },
      },
    },
  },
  {
    name: 'project_detail',
    description: 'Full detail for ONE project by code, name, or id: stage/phase, client & service, all PMs, deal value & per-category values, dates, Dropbox/ClickUp/QuickBooks refs, and counts of its documents and production items.',
    input_schema: {
      type: 'object' as const,
      properties: { project: { type: 'string', description: 'Project code, name, or id.' } },
      required: ['project'],
    },
  },
  {
    name: 'production_board',
    description:
      'Production board items (PFs/orders) for a project or across projects. Each item: type, pf_code, status, order_type, vendor, pf_usd/pf_tl, invoice, PO/PF sign status, container. ' +
      'Known statuses include ORDERED, IN_PRODUCTION, ASSEMBLY, READY, WAITING_PAYMENT, READY_TO_RECEIVE, DELIVERED, HOLD. Use a status filter for questions like "what is waiting for payment" or "what is READY".',
    input_schema: {
      type: 'object' as const,
      properties: {
        project: { type: 'string', description: 'Optional project code/name/id to scope to.' },
        status:  { type: 'string', description: 'Optional status filter (matches part of the status).' },
        vendor:  { type: 'string', description: 'Optional vendor name/code filter.' },
        limit:   { type: 'number', description: 'Max rows (default 100).' },
      },
    },
  },
  {
    name: 'directory',
    description: 'Team directory: people with their role, whether they are the global PM Supervisor, and which region (client) a Client PM manages.',
    input_schema: { type: 'object' as const, properties: { search: { type: 'string', description: 'Optional name/role filter.' } } },
  },
  {
    name: 'clients_and_services',
    description: 'Clients (regions) and the services/companies under each, with their margin %. Use for "what is the margin for X", "which services does client Y have".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'vendors',
    description: 'List of production vendors/suppliers (name, code, country).',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'payments_overview',
    description: 'Money owed/expected on the production board: items in WAITING_PAYMENT (we owe vendor) and READY_TO_RECEIVE (client owes us), with per-item amounts and totals (USD & TL). Use for "what is waiting for payment", "how much do we owe X".',
    input_schema: {
      type: 'object' as const,
      properties: { project: { type: 'string', description: 'Optional project code/name to scope to.' } },
    },
  },
  {
    name: 'pending_approvals',
    description: 'Documents not yet fully approved (status draft/pending/waiting/signed but not approved), i.e. what is waiting on a signature. Optionally scope to one project or filter by doc type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project:  { type: 'string', description: 'Optional project code/name.' },
        doc_type: { type: 'string', description: 'Optional doc type filter (e.g. po, pf, item_list, book).' },
        limit:    { type: 'number', description: 'Max rows (default 80).' },
      },
    },
  },
  {
    name: 'project_documents',
    description: 'The document set of ONE project: each document with its doc_type, version, status, branch/category and upload date. Use for "what documents does project X have", "is the PO approved".',
    input_schema: {
      type: 'object' as const,
      properties: { project: { type: 'string', description: 'Project code, name, or id.' } },
      required: ['project'],
    },
  },
  {
    name: 'document_items',
    description: 'Read the line items INSIDE a document (e.g. Item List / Item Price List): item code, description, quantity, unit price. Use for "what is the price of X in project Y", "list the items in the price list". Photos/signatures are stripped.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project:  { type: 'string', description: 'Project code, name, or id.' },
        doc_type: { type: 'string', description: 'Which document (e.g. item_price_list, item_list). Latest matching version is used.' },
        search:   { type: 'string', description: 'Optional: only items whose code/description matches this text.' },
      },
      required: ['project', 'doc_type'],
    },
  },
  {
    name: 'deadlines',
    description: 'Projects by delivery date: overdue, due soon, or upcoming, using est_delivery_date and hard_deadline vs today. Use for "what is due this week", "which projects are overdue".',
    input_schema: {
      type: 'object' as const,
      properties: { within_days: { type: 'number', description: 'Only projects due within this many days (default 30). Overdue always included.' } },
    },
  },
  {
    name: 'vendor_orders',
    description: 'Spend/orders grouped by vendor: how many production items and total amounts (USD/TL) per vendor. Use for "how much did we order from X", "which vendor has the most orders".',
    input_schema: {
      type: 'object' as const,
      properties: { project: { type: 'string', description: 'Optional project code/name to scope to.' } },
    },
  },
  {
    name: 'recent_activity',
    description: 'Recent audit-log activity (who did what, when) — approvals, status changes, edits. Optionally scope to one project.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project: { type: 'string', description: 'Optional project code/name.' },
        limit:   { type: 'number', description: 'Max events (default 25).' },
      },
    },
  },
  {
    name: 'overview_stats',
    description: 'Company-wide snapshot: project counts by stage, total deal value, production items by status, documents pending approval, and client/vendor counts. Use for "give me an overview", "how are we doing".',
    input_schema: { type: 'object' as const, properties: {} },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runAssistantTool(toolName: string, input: any, ctx: AiCtx): Promise<unknown> {
  const sb = admin();
  try {
    const m = await maps(sb);
    const scopedClientId = ctx.role === 'tlines_pm' ? ctx.pmClientId : null;

    const restricted = ctx.role === 'tlines_pm';
    const DENIED_FOR_RESTRICTED = new Set(['production_board', 'payments_overview', 'vendor_orders', 'vendors']);
    if (restricted && DENIED_FOR_RESTRICTED.has(toolName)) {
      return { error: 'This information is not available for your role.' };
    }

    const likeSafe = (v: unknown) => String(v ?? '').replace(/[,()*%\\]/g, ' ').trim();

    const resolveProjectId = async (key: string): Promise<string | null> => {
      const k = likeSafe(key);
      let q = sb.from('projects').select('id').eq('is_draft', false).or(`code.ilike.%${k}%,name.ilike.%${k}%`);
      if (scopedClientId) q = q.eq('client_id', scopedClientId);
      const { data } = await q.limit(1);
      return data?.[0]?.id ?? null;
    };
    const scopedProjectIds = async (): Promise<string[] | null> => {
      if (!scopedClientId) return null;
      const { data } = await sb.from('projects').select('id').eq('is_draft', false).eq('client_id', scopedClientId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => r.id);
    };
    const codeById = async (ids: string[]): Promise<Record<string, string>> => {
      if (!ids.length) return {};
      const { data } = await sb.from('projects').select('id, code, name').eq('is_draft', false).in('id', ids);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.code || p.name]));
    };
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectCard = (p: any) => ({
      code: p.code, name: p.name,
      stage: p.current_stage, phase: p.current_phase,
      client: m.clients[p.client_id]?.name ?? null,
      service: m.companies[p.client_company_id]?.name ?? null,
      ...(restricted ? {} : { margin_pct: m.companies[p.client_company_id]?.margin_pct ?? null }),
      trust_pm: name(m.people, p.trustlines_pm_id),
      client_pm: name(m.people, p.tlines_pm_id),
      pm_supervisor: name(m.people, p.pm_supervisor_id),
      deal_value: p.deal_value, currency: p.currency,
      est_delivery_date: p.est_delivery_date, hard_deadline: p.hard_deadline,
      actual_delivery_date: p.actual_delivery_date,
      archived: p.is_archived || !!p.deleted_at,
    });

    if (toolName === 'list_projects') {
      let q = sb.from('projects').select('*').eq('is_draft', false);
      if (scopedClientId) q = q.eq('client_id', scopedClientId);
      if (!input?.include_archived) q = q.is('deleted_at', null).eq('is_archived', false);
      if (input?.stage)  q = q.eq('current_stage', input.stage);
      if (input?.search) { const s = likeSafe(input.search); q = q.or(`code.ilike.%${s}%,name.ilike.%${s}%`); }
      const { data, error } = await q.limit(Math.min(input?.limit ?? 50, 200));
      if (error) return { error: error.message };
      return { count: data.length, projects: data.map(projectCard) };
    }

    if (toolName === 'project_detail') {
      const key = likeSafe(input.project);
      let q = sb.from('projects').select('*').eq('is_draft', false)
        .or(`code.ilike.%${key}%,name.ilike.%${key}%`);
      if (scopedClientId) q = q.eq('client_id', scopedClientId);
      const { data, error } = await q.limit(1);
      if (error) return { error: error.message };
      if (!data?.length) return { found: false, message: `No project matching "${key}".` };
      const p = data[0];
      const [{ count: docCount }, { count: itemCount }] = await Promise.all([
        sb.from('documents').select('id', { count: 'exact', head: true }).eq('project_id', p.id),
        sb.from('production_items').select('id', { count: 'exact', head: true }).eq('project_id', p.id).is('deleted_at', null),
      ]);
      return {
        ...projectCard(p),
        categories: p.categories, category_values: p.category_values,
        payment_terms: p.payment_terms, closed_deal_date: p.closed_deal_date,
        scope_summary: p.scope_summary,
        dropbox_root_path: p.dropbox_root_path, clickup_task_id: p.clickup_task_id, quickbooks_ref: p.quickbooks_ref,
        document_count: docCount ?? 0, production_item_count: itemCount ?? 0,
      };
    }

    if (toolName === 'production_board') {
      let projectId: string | null = null;
      if (input?.project) {
        const pk = likeSafe(input.project);
        const { data } = await sb.from('projects').select('id').eq('is_draft', false).or(`code.ilike.%${pk}%,name.ilike.%${pk}%`).limit(1);
        projectId = data?.[0]?.id ?? null;
        if (!projectId) return { found: false, message: `No project matching "${input.project}".` };
      }
      let q = sb.from('production_items').select('*').is('deleted_at', null);
      if (projectId) q = q.eq('project_id', projectId);
      if (input?.status) q = q.ilike('status', `%${input.status}%`);
      const { data, error } = await q.limit(Math.min(input?.limit ?? 100, 300));
      if (error) return { error: error.message };
      const boardCodes = await codeById([...new Set((data ?? []).map((r: { project_id: string }) => r.project_id).filter(Boolean))] as string[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rows = (data ?? []).map((it: any) => ({
        project: boardCodes[it.project_id] ?? null, pf_code: it.pf_code, type: it.type,
        status: it.status, order_type: it.order_type,
        vendor: m.vendors[it.vendor_id]?.name ?? null,
        pf_usd: it.pf_usd, pf_tl: it.pf_tl, invoice: it.invoice,
        po_sign_status: it.po_sign_status, pf_sign_status: it.pf_sign_status,
        container_no: it.container_no, container_date: it.container_date,
      }));
      if (input?.vendor) {
        const v = String(input.vendor).toLowerCase();
        rows = rows.filter((r: { vendor: string | null }) => (r.vendor ?? '').toLowerCase().includes(v));
      }
      return { count: rows.length, items: rows };
    }

    if (toolName === 'directory') {
      let people = m.peopleList;
      if (input?.search) {
        const s = String(input.search).toLowerCase();
        people = people.filter(p => (p.full_name ?? '').toLowerCase().includes(s) || (p.role ?? '').toLowerCase().includes(s));
      }
      return {
        people: people.map(p => ({
          name: p.full_name, role: p.role, active: p.is_active,
          pm_supervisor: p.is_pm_supervisor || false,
          manages_region: p.pm_client_id ? (m.clients[p.pm_client_id]?.name ?? null) : null,
        })),
      };
    }

    if (toolName === 'clients_and_services') {
      return {
        clients: m.clientList.map(c => ({
          client: c.name, code: c.code,
          services: m.companyList.filter(co => co.client_id === c.id)
            .map(co => ({ name: co.name, code: co.code, ...(restricted ? {} : { margin_pct: co.margin_pct }) })),
        })),
      };
    }

    if (toolName === 'vendors') {
      return { vendors: m.vendorList.map(v => ({ name: v.name, code: v.code, country: v.country })) };
    }

    if (toolName === 'payments_overview') {
      let q = sb.from('production_items').select('*').is('deleted_at', null)
        .in('status', ['WAITING_PAYMENT', 'READY_TO_RECEIVE']);
      if (input?.project) {
        const pid = await resolveProjectId(input.project);
        if (!pid) return { found: false, message: `No project matching "${input.project}".` };
        q = q.eq('project_id', pid);
      } else {
        const ids = await scopedProjectIds();
        if (ids) q = q.in('project_id', ids);
      }
      const { data, error } = await q.limit(300);
      if (error) return { error: error.message };
      const codes = await codeById([...new Set((data ?? []).map((r: { project_id: string }) => r.project_id))] as string[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (data ?? []).map((it: any) => ({
        project: codes[it.project_id], pf_code: it.pf_code, vendor: m.vendors[it.vendor_id]?.name ?? null,
        status: it.status, pf_usd: it.pf_usd, pf_tl: it.pf_tl, invoice: it.invoice, invoice_tl: it.invoice_tl,
      }));
      const sum = (k: string, st: string) => items.filter((i: Record<string, unknown>) => i.status === st).reduce((a: number, i: Record<string, unknown>) => a + num(i[k]), 0);
      return {
        count: items.length,
        we_owe_vendor_usd:   sum('pf_usd', 'WAITING_PAYMENT'),
        client_owes_us_usd:  sum('invoice', 'READY_TO_RECEIVE'),
        items,
      };
    }

    if (toolName === 'pending_approvals') {
      let q = sb.from('documents').select('id, project_id, doc_type, cat_group, version, status, file_name')
        .neq('status', 'approved').neq('status', 'superseded');
      if (restricted) q = q.neq('doc_type', 'pf');
      if (input?.project) {
        const pid = await resolveProjectId(input.project);
        if (!pid) return { found: false, message: `No project matching "${input.project}".` };
        q = q.eq('project_id', pid);
      } else {
        const ids = await scopedProjectIds();
        if (ids) q = q.in('project_id', ids);
      }
      if (input?.doc_type) q = q.ilike('doc_type', `%${input.doc_type}%`);
      const { data, error } = await q.limit(Math.min(input?.limit ?? 80, 200));
      if (error) return { error: error.message };
      const codes = await codeById([...new Set((data ?? []).map((r: { project_id: string }) => r.project_id))] as string[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { count: data.length, documents: (data ?? []).map((d: any) => ({
        project: codes[d.project_id], doc_type: d.doc_type, category: d.cat_group, version: d.version, status: d.status, file_name: d.file_name,
      })) };
    }

    if (toolName === 'project_documents') {
      const pid = await resolveProjectId(String(input.project));
      if (!pid) return { found: false, message: `No project matching "${input.project}".` };
      let dq = sb.from('documents')
        .select('doc_type, cat_group, version, status, branch, uploaded_at')
        .eq('project_id', pid).order('uploaded_at', { ascending: false }).limit(300);
      if (restricted) dq = dq.neq('doc_type', 'pf');
      const { data, error } = await dq;
      if (error) return { error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { count: data.length, documents: (data ?? []).map((d: any) => ({
        doc_type: d.doc_type, category: d.cat_group, version: d.version, status: d.status, branch: d.branch, uploaded_at: d.uploaded_at,
      })) };
    }

    if (toolName === 'document_items') {
      const pid = await resolveProjectId(String(input.project));
      if (!pid) return { found: false, message: `No project matching "${input.project}".` };
      const { data, error } = await sb.from('documents')
        .select('doc_type, version, form_data')
        .eq('project_id', pid).ilike('doc_type', `%${input.doc_type}%`)
        .order('version', { ascending: false }).limit(1);
      if (error) return { error: error.message };
      if (!data?.length) return { found: false, message: `No "${input.doc_type}" document on that project.` };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fd: any = data[0].form_data ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections: any[] = Array.isArray(fd.sections) ? fd.sections : [];
      const KEEP = ['item_code', 'code', 'description', 'desc', 'quantity', 'qty', 'unit', 'unit_price', 'price', 'total',
        ...(restricted ? [] : ['margin'])];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slim = (it: any) => Object.fromEntries(Object.entries(it).filter(([k, v]) =>
        KEEP.includes(k) && !(typeof v === 'string' && v.length > 200)));
      const s = String(input.search ?? '').toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let items: any[] = sections.flatMap((sec: any) =>
        (Array.isArray(sec.items) ? sec.items : []).map((it: any) => ({ section: sec.type ?? sec.title ?? null, ...slim(it) })));
      if (s) items = items.filter(it => JSON.stringify(it).toLowerCase().includes(s));
      return { doc_type: data[0].doc_type, version: data[0].version, item_count: items.length, items: items.slice(0, 200) };
    }

    if (toolName === 'deadlines') {
      const within = input?.within_days ?? 30;
      let q = sb.from('projects').select('*').eq('is_draft', false).is('deleted_at', null).eq('is_archived', false).is('actual_delivery_date', null);
      if (scopedClientId) q = q.eq('client_id', scopedClientId);
      const { data, error } = await q.limit(500);
      if (error) return { error: error.message };
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizon = new Date(today); horizon.setDate(horizon.getDate() + within);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []).map((p: any) => {
        const d = p.est_delivery_date || p.hard_deadline;
        return d ? { code: p.code, name: p.name, stage: p.current_stage, due: d, date: new Date(d) } : null;
      }).filter(Boolean)
        .filter((r: { date: Date }) => r.date <= horizon || r.date < today)
        .sort((a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => ({ code: r.code, name: r.name, stage: r.stage, due: r.due, overdue: r.date < today }));
      return { count: rows.length, projects: rows };
    }

    if (toolName === 'vendor_orders') {
      let q = sb.from('production_items').select('vendor_id, project_id, pf_usd, pf_tl, invoice').is('deleted_at', null);
      if (input?.project) {
        const pid = await resolveProjectId(input.project);
        if (!pid) return { found: false, message: `No project matching "${input.project}".` };
        q = q.eq('project_id', pid);
      } else {
        const ids = await scopedProjectIds();
        if (ids) q = q.in('project_id', ids);
      }
      const { data, error } = await q.limit(2000);
      if (error) return { error: error.message };
      const agg: Record<string, { vendor: string; orders: number; pf_usd: number; pf_tl: number; invoice: number }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const it of (data ?? []) as any[]) {
        const key = it.vendor_id ?? 'none';
        agg[key] ??= { vendor: m.vendors[it.vendor_id]?.name ?? 'Unassigned', orders: 0, pf_usd: 0, pf_tl: 0, invoice: 0 };
        agg[key].orders++; agg[key].pf_usd += num(it.pf_usd); agg[key].pf_tl += num(it.pf_tl); agg[key].invoice += num(it.invoice);
      }
      return { vendors: Object.values(agg).sort((a, b) => b.pf_usd - a.pf_usd) };
    }

    if (toolName === 'recent_activity') {
      let q = sb.from('audit_log').select('*').order('created_at', { ascending: false });
      if (input?.project) {
        const pid = await resolveProjectId(input.project);
        if (!pid) return { found: false, message: `No project matching "${input.project}".` };
        q = q.eq('project_id', pid);
      } else {
        const ids = await scopedProjectIds();
        if (ids) q = q.in('project_id', ids);
      }
      const { data, error } = await q.limit(Math.min(input?.limit ?? 25, 100));
      if (error) return { error: error.message };
      const codes = await codeById([...new Set((data ?? []).map((r: { project_id: string }) => r.project_id).filter(Boolean))] as string[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { count: data.length, events: (data ?? []).map((a: any) => ({
        when: a.created_at, who: name(m.people, a.actor_id), action: a.action, resource: a.resource, project: a.project_id ? codes[a.project_id] : null,
      })) };
    }

    if (toolName === 'overview_stats') {
      let pq = sb.from('projects').select('current_stage, deal_value, currency, client_id').eq('is_draft', false).is('deleted_at', null).eq('is_archived', false);
      if (scopedClientId) pq = pq.eq('client_id', scopedClientId);
      const ids = await scopedProjectIds();
      let iq = sb.from('production_items').select('status, project_id').is('deleted_at', null);
      if (ids) iq = iq.in('project_id', ids);
      let dq = sb.from('documents').select('id', { count: 'exact', head: true }).neq('status', 'approved').neq('status', 'superseded');
      if (ids) dq = dq.in('project_id', ids);
      const [projects, items, docs] = await Promise.all([pq, iq, dq]);
       
      const byStage: Record<string, number> = {}; let dealTotal = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (projects.data ?? []) as any[]) { byStage[p.current_stage ?? 'unknown'] = (byStage[p.current_stage ?? 'unknown'] ?? 0) + 1; dealTotal += num(p.deal_value); }
      const byItemStatus: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const it of (items.data ?? []) as any[]) byItemStatus[it.status ?? 'unknown'] = (byItemStatus[it.status ?? 'unknown'] ?? 0) + 1;
      return {
        projects_total: (projects.data ?? []).length, projects_by_stage: byStage, total_deal_value_usd: dealTotal,
        production_items_by_status: byItemStatus, documents_pending_approval: docs.count ?? 0,
        clients: m.clientList.length, services: m.companyList.length, vendors: m.vendorList.length, people: m.peopleList.length,
      };
    }

    return { error: `Unknown tool: ${toolName}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Tool failed' };
  }
}
