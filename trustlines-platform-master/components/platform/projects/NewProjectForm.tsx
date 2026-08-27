'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Check, Plus, Info, ArrowRight, Folder } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { newProjectSchema, type NewProjectFormValues } from '@/lib/validations/project';
import { DropboxProjectBrowser, type DropboxProjectSelection } from './DropboxProjectBrowser';
import { LocationSearch } from './LocationSearch';
import { US_STATES } from '@/lib/usStates';
import { REGIONS, composeProjectCode, dropboxRegionFolder } from '@/lib/regions';

interface ProfileRow { id: string; full_name: string }
interface PmProfileRow extends ProfileRow { pm_client_id?: string | null; is_pm_supervisor?: boolean }
interface ClientRow { id: string; name: string; code: string | null }

export interface EditProjectData {
  id: string;
  name: string;
  project_code: string;
  client_id: string;
  client_company_id: string | null;
  site_location: string;
  closed_deal_date: string;
  est_delivery_date: string;
  categories: string[];
  category_values: Record<string, number> | null;
  deal_value: number | null;
  currency: 'USD' | 'EUR' | 'TRY';
  clickup_task_id: string | null;
  quickbooks_ref: string | null;
  tlines_pm_id: string | null;
  trustlines_pm_id: string | null;
  dropbox_root_path: string | null;
}

interface Props {
  currentUserId: string;
  userRole?: string;
  clients: ClientRow[];
  tlinesPmProfiles: PmProfileRow[];
  trustlinesPmProfiles: ProfileRow[];
  qcProfiles: ProfileRow[];
  allFranchises: { id: string; name: string; code: string | null; client_id: string }[];
  allCompanies: { id: string; name: string; code: string | null; client_id: string | null }[];

  editProject?: EditProjectData;
}

const DEFAULT_CATEGORIES = ['Millwork', 'Shelving', 'Image', 'Ceiling', 'Furniture', 'Decoration'];
const SHOW_CUSTOM_CATEGORY = true;

function sectionFromService(name?: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('store maker')) return '1-Store Maker';
  if (n.includes('premium')) return '2-Premium Store Fitout';
  if (n.includes('design')) return '3-Design & Build';
  if (n.includes('shop')) return '4-T Shop';
  return '';
}

function serviceLineFromCompanyName(name?: string | null): string | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('store maker')) return 'store_maker';
  if (n.includes('premium')) return 'premium_store_fitout';
  if (n.includes('design')) return 'design_build';
  return null;
}

function regionCodeForClient(client?: { code: string | null; name: string | null } | null): string {
  if (!client) return '';
  const code = (client.code ?? '').trim().toUpperCase();
  const byCode = REGIONS.find(r => r.codeShort.toUpperCase() === code || r.dropboxShort.toUpperCase() === code);
  if (byCode) return byCode.code;
  const name = (client.name ?? '').toUpperCase();
  return REGIONS.find(r => name.includes(r.dropboxShort.toUpperCase()))?.code ?? '';
}

function formatThousands(raw: string): string {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withSep}.${decPart}` : withSep;
}

function sanitizeAmount(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

function FieldLabel({
  children,
  required,
  aiField,
}: {
  children: React.ReactNode;
  required?: boolean;
  aiField?: boolean;
}) {
  return (
    <label className={`form-label${required ? ' required' : ''}`}>
      {children}
      {aiField && <span className="ai-badge">✦ AI</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="form-error">{msg}</div>;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Project info', subtitle: 'Region, company, location' },
  { id: 2, title: 'Categories & value', subtitle: 'Categories, currency, total' },
  { id: 3, title: 'Timeline', subtitle: 'Delivery date' },
  { id: 4, title: 'Dropbox folder', subtitle: 'Folder rules & details' },
  { id: 5, title: 'Integrations', subtitle: 'ClickUp, QuickBooks' },
  { id: 6, title: 'Initial team', subtitle: 'Assign project team' },
];

export function NewProjectForm({
  currentUserId,
  userRole = 'ops_manager',
  clients,
  tlinesPmProfiles,
  trustlinesPmProfiles,
  qcProfiles,
  allFranchises,
  allCompanies,
  editProject,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!editProject;

  const [activeStep, setActiveStep] = useState<number>(1);

  // Quick extract state
  const [emailText, setEmailText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  // Client / Region state
  const [selectedClientId, setSelectedClientId] = useState(editProject?.client_id ?? '');
  const [, setSelectedFranchiseId] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [localClients, setLocalClients] = useState<ClientRow[]>(clients);

  const companies = allCompanies.filter(c => c.client_id === selectedClientId);
  const editCompany = allCompanies.find(c => c.id === editProject?.client_company_id) ?? null;

  const regionalPm = tlinesPmProfiles.find(p => p.pm_client_id === selectedClientId) ?? null;
  const supervisor = tlinesPmProfiles.find(p => p.is_pm_supervisor) ?? null;

  // Categories & Values
  const [selectedCats, setSelectedCats] = useState<string[]>(editProject?.categories ?? []);
  const [customCatInput, setCustomCatInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [extraCats, setExtraCats] = useState<string[]>(
    () => (editProject?.categories ?? []).filter(c => !DEFAULT_CATEGORIES.includes(c)),
  );

  const [catValues, setCatValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(editProject?.category_values ?? {})) out[k] = String(v);
    return out;
  });

  const [searchState, setSearchState] = useState('');

  // Auto numbering / Region
  const [trustRegion, setTrustRegion] = useState(
    () => editProject ? regionCodeForClient(clients.find(c => c.id === editProject.client_id)) : '',
  );
  const [trustAutoNumber, setTrustAutoNumber] = useState<number | null>(null);

  // Dropbox import
  const [showDropboxBrowser, setShowDropboxBrowser] = useState(false);
  const [importSelection, setImportSelection] = useState<DropboxProjectSelection | null>(null);

  // Submit / Checking state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDropbox, setIsCheckingDropbox] = useState(false);
  const [dropboxConflict, setDropboxConflict] = useState<{
    existingPath: string;
    existingName: string;
  } | null>(null);
  const [pendingValues, setPendingValues] = useState<NewProjectFormValues | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectSchema),
    mode: 'onChange',
    defaultValues: editProject
      ? {
        name: editProject.name,
        project_code: editProject.project_code,
        client_id: editProject.client_id,
        client_company_id: editProject.client_company_id ?? undefined,
        site_location: editProject.site_location,
        closed_deal_date: editProject.closed_deal_date,
        est_delivery_date: editProject.est_delivery_date,
        categories: editProject.categories,
        deal_value: editProject.deal_value ?? undefined,
        currency: editProject.currency,
        clickup_task_id: editProject.clickup_task_id ?? undefined,
        quickbooks_ref: editProject.quickbooks_ref ?? undefined,
        tlines_pm_id: editProject.tlines_pm_id ?? '',
        trustlines_pm_id: editProject.trustlines_pm_id ?? '',
        dropbox_section: '(unchanged)',
        dropbox_region: '(unchanged)',
        dropbox_status: 'Under Working',
        dropbox_client_type: editProject.dropbox_root_path?.includes('/Individiuals/') ? 'Individuals' : 'Clients',
      }
      : { currency: 'USD', dropbox_status: 'Under Working', dropbox_client_type: 'Individuals' },
  });

  const watchedCode = watch('project_code');
  const watchedServiceId = watch('client_company_id');
  const watchedClientName = watch('dropbox_client_name');
  const watchedSiteLocation = watch('site_location');
  const watchedClosedDate = watch('closed_deal_date');
  const watchedCurrency = watch('currency') ?? 'USD';

  useEffect(() => {
    setValue('categories', selectedCats, { shouldValidate: true });
  }, [selectedCats, setValue]);

  useEffect(() => {
    const sum = selectedCats.reduce((a, c) => a + (parseFloat(catValues[c] ?? '') || 0), 0);
    setValue('deal_value', sum > 0 ? sum : undefined, { shouldValidate: true });
  }, [selectedCats, catValues, setValue]);

  useEffect(() => {
    if (isEdit) return;
    if (!selectedClientId) return;
    const regional = tlinesPmProfiles.find(p => p.pm_client_id === selectedClientId);
    const sup = tlinesPmProfiles.find(p => p.is_pm_supervisor);
    setValue('tlines_pm_id', regional?.id ?? sup?.id ?? '', { shouldValidate: true });
  }, [isEdit, selectedClientId, tlinesPmProfiles, setValue]);

  const selectedCompany = allCompanies.find(c => c.id === watchedServiceId);
  const selectedClient = localClients.find(c => c.id === selectedClientId);
  const derivedServiceLine = serviceLineFromCompanyName(selectedCompany?.name);

  const autoCodeMode = !isEdit && !importSelection && !!trustRegion && !!derivedServiceLine;

  useEffect(() => {
    if (isEdit) return;
    if (importSelection) return;
    const client = localClients.find(c => c.id === selectedClientId);

    setValue('dropbox_region', trustRegion ? dropboxRegionFolder(trustRegion) : (client?.code ? `T Lines ${client.code} Projects` : ''), { shouldValidate: true });
    const svc = allCompanies.find(c => c.id === watchedServiceId);
    setValue('dropbox_section', sectionFromService(svc?.name), { shouldValidate: true });
    setValue('dropbox_status', 'Under Working', { shouldValidate: true });
    const cname = (watchedClientName ?? '').trim();
    setValue('dropbox_client_type', cname ? 'Clients' : 'Individuals', { shouldValidate: true });
  }, [isEdit, selectedClientId, watchedServiceId, watchedClientName, importSelection, localClients, allCompanies, trustRegion, setValue]);

  useEffect(() => {
    if (!autoCodeMode) { setTrustAutoNumber(null); return; }
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('peek_global_number')
      .then(({ data, error }: { data: number | null; error: unknown }) => {
        if (!cancelled && !error) setTrustAutoNumber((data as number) ?? null);
      });
    return () => { cancelled = true; };
  }, [autoCodeMode, supabase]);

  useEffect(() => {
    if (autoCodeMode && trustAutoNumber != null) {
      setValue('project_code', composeProjectCode(derivedServiceLine, trustRegion, trustAutoNumber), { shouldValidate: true });
    }
  }, [autoCodeMode, trustAutoNumber, trustRegion, derivedServiceLine, setValue]);

  async function handleExtract() {
    if (!emailText.trim()) return;
    setIsExtracting(true);
    setExtractMsg('');
    try {
      const res = await fetch('/api/ai/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText }),
      });
      const { fields } = (await res.json()) as { fields: Record<string, unknown> };
      const filled = new Set<string>();
      let count = 0;

      if (fields.project_name) { setValue('name', String(fields.project_name)); filled.add('name'); count++; }
      if (fields.project_code) { setValue('project_code', String(fields.project_code), { shouldValidate: true }); filled.add('project_code'); count++; }
      if (fields.closed_deal_date) { setValue('closed_deal_date', String(fields.closed_deal_date)); filled.add('closed_deal_date'); count++; }
      if (fields.site_location) { setValue('site_location', String(fields.site_location)); filled.add('site_location'); count++; }
      if (typeof fields.deal_value === 'number') {
        setValue('deal_value', fields.deal_value as number);
        filled.add('deal_value'); count++;
      }
      if (fields.currency && ['USD', 'EUR', 'TRY'].includes(String(fields.currency))) {
        setValue('currency', fields.currency as 'USD' | 'EUR' | 'TRY');
        filled.add('currency'); count++;
      }

      setAiFields(filled);
      if (count > 0) {
        setExtractMsg(`${count} field${count > 1 ? 's' : ''} extracted ✓`);
      } else {
        setExtractMsg('Could not extract fields. Fill manually.');
      }
    } catch {
      setExtractMsg('Could not extract fields. Fill manually.');
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSaveClient() {
    if (!newClientName.trim()) return;
    setSavingClient(true);
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim(), code: newClientCode.trim() || null, is_active: true } as never)
      .select('id, name, code')
      .single();
    if (error || !data) { toast.error('Failed to save client'); setSavingClient(false); return; }
    const nc = data as ClientRow;
    setLocalClients(prev => [...prev, nc]);
    setSelectedClientId(nc.id);
    setValue('client_id', nc.id, { shouldValidate: true });
    setNewClientName('');
    setNewClientCode('');
    setShowNewClientForm(false);
    setSavingClient(false);
  }

  function toggleCat(cat: string) {
    setSelectedCats(prev => {
      const has = prev.includes(cat);
      if (has) setCatValues(v => { const n = { ...v }; delete n[cat]; return n; });
      return has ? prev.filter(c => c !== cat) : [...prev, cat];
    });
  }

  function addCustomCat() {
    const val = customCatInput.trim();
    if (!val || extraCats.includes(val) || DEFAULT_CATEGORIES.includes(val)) return;
    setExtraCats(prev => [...prev, val]);
    setSelectedCats(prev => [...prev, val]);
    setCustomCatInput('');
    setShowCustomInput(false);
  }

  function buildDropboxParentPath(values: NewProjectFormValues): string {
    const clientTypeFolder = values.dropbox_client_type === 'Individuals' ? 'Individiuals' : 'Clients';
    const parts = [
      '/D-Projects/T LINES',
      values.dropbox_section,
      values.dropbox_region,
      values.dropbox_status,
      clientTypeFolder,
    ];
    if (values.dropbox_client_type === 'Clients' && values.dropbox_client_name?.trim()) {
      parts.push(values.dropbox_client_name.trim());
    }
    return parts.join('/');
  }

  async function proceedWithCreate(
    values: NewProjectFormValues,
    importFromDropboxPath: string | null,
  ) {
    setIsSubmitting(true);
    setDropboxConflict(null);
    setPendingValues(null);
    try {
      let code = values.project_code.trim();
      let regionForInsert: string | null = null;
      let serviceLineForInsert: string | null = null;
      if (autoCodeMode && !importFromDropboxPath && derivedServiceLine) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: num, error } = await (supabase as any).rpc('reserve_global_number');
        if (error) throw new Error(error.message);
        code = composeProjectCode(derivedServiceLine, trustRegion, num as number);
        regionForInsert = trustRegion;
        serviceLineForInsert = derivedServiceLine;
      }

      const finalName = (autoCodeMode && !importFromDropboxPath)
        ? `${code} - ${values.site_location}`
        : values.name;

      const dropboxClientName = values.dropbox_client_type === 'Clients'
        ? (values.dropbox_client_name?.trim() || undefined)
        : undefined;

      const computedDropboxPath = [
        '/D-Projects/T LINES',
        values.dropbox_section,
        values.dropbox_region,
        values.dropbox_status,
        values.dropbox_client_type === 'Individuals' ? 'Individiuals' : 'Clients',
        ...(values.dropbox_client_type === 'Clients' && dropboxClientName ? [dropboxClientName] : []),
        `${code} - ${values.site_location}`,
      ].join('/');

      const dropboxRootPath = importFromDropboxPath ?? computedDropboxPath;

      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          code,
          name: finalName,
          client_id: values.client_id,
          client_franchise_id: values.client_franchise_id ?? null,
          client_company_id: values.client_company_id ?? null,
          ...(regionForInsert ? { region: regionForInsert, service_line: serviceLineForInsert } : {}),
          site_location: values.site_location,
          closed_deal_date: values.closed_deal_date,
          categories: values.categories,
          deal_value: values.deal_value ?? null,
          currency: values.currency,
          est_delivery_date: values.est_delivery_date,
          clickup_task_id: values.clickup_task_id || null,
          quickbooks_ref: values.quickbooks_ref || null,
          trustlines_pm_id: values.trustlines_pm_id,
          tlines_pm_id: values.tlines_pm_id,
          qc_inspector_id: null,
          ops_manager_id: currentUserId,
          created_by: currentUserId,
          current_stage: 'closed_deal',
          current_phase: 'finalization',
          dropbox_root_path: dropboxRootPath,
          is_archived: false,
          hard_deadline: false,
        } as never)
        .select('id')
        .single();

      if (insertError || !project) {
        const msg = insertError?.message ?? 'Failed to create project';
        const isDuplicate = msg.includes('duplicate key') || msg.includes('unique constraint');
        throw new Error(isDuplicate ? `Project code "${code}" already exists. Use a different code.` : msg);
      }
      const projectId = (project as { id: string }).id;

      {
        const catVals: Record<string, number> = {};
        for (const c of values.categories ?? []) { const n = parseFloat(catValues[c] ?? ''); if (n > 0) catVals[c] = n; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('projects').update({ category_values: catVals }).eq('id', projectId).then((r: { error?: { message?: string } | null }) => {
          if (r?.error && !/column|schema cache/i.test(r.error.message ?? '')) console.error('[new-project] category_values:', r.error.message);
        });
      }

      if (supervisor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('projects').update({ pm_supervisor_id: supervisor.id }).eq('id', projectId).then((r: { error?: { message?: string } | null }) => {
          if (r?.error && !/column|schema cache/i.test(r.error.message ?? '')) console.error('[new-project] supervisor:', r.error.message);
        });
      }

      await fetch(`/api/projects/${projectId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'phase1', step_key: 'closed_deal', cat_group: null,
          status: 'done', completed_by: currentUserId,
          completed_at: new Date(values.closed_deal_date).toISOString(),
        }),
      }).catch(() => { });

      let dropboxMsg = '';
      if (importFromDropboxPath) {
        dropboxMsg = ` Linked to existing Dropbox folder "${importFromDropboxPath.split('/').pop()}".`;
      } else {
        try {
          const dbRes = await fetch('/api/dropbox/create-folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dropboxSection: values.dropbox_section,
              dropboxRegion: values.dropbox_region,
              dropboxStatus: values.dropbox_status,
              dropboxClientType: values.dropbox_client_type,
              dropboxClientName,
              projectNo: code,
              address: values.site_location,
              categories: values.categories ?? [],
            }),
          });
          if (dbRes.ok) {
            const body = await dbRes.json() as { alreadyExists?: boolean };
            dropboxMsg = body.alreadyExists
              ? ' Existing Dropbox folder preserved.'
              : ' Dropbox folders created ✓';
          } else {
            dropboxMsg = ' (Dropbox setup pending — retry from project page)';
          }
        } catch {
          dropboxMsg = ' (Dropbox setup pending — retry from project page)';
        }
      }

      await supabase.from('audit_log').insert({
        project_id: projectId,
        actor_id: currentUserId,
        action: 'project.created',
        new_value: {
          name: values.name, code, categories: values.categories,
          importedFromDropbox: !!importFromDropboxPath
        },
      } as never);

      toast.success(`Project ${code} created.${dropboxMsg}`);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  async function updateProject(values: NewProjectFormValues) {
    if (!editProject) return;
    setIsSubmitting(true);
    try {
      const catVals: Record<string, number> = {};
      for (const c of values.categories ?? []) { const n = parseFloat(catValues[c] ?? ''); if (n > 0) catVals[c] = n; }

      const res = await fetch(`/api/projects/${editProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          site_location: values.site_location,
          closed_deal_date: values.closed_deal_date,
          est_delivery_date: values.est_delivery_date,
          categories: values.categories,
          category_values: catVals,
          deal_value: values.deal_value ?? null,
          currency: values.currency,
          clickup_task_id: values.clickup_task_id || null,
          quickbooks_ref: values.quickbooks_ref || null,
          tlines_pm_id: values.tlines_pm_id,
          trustlines_pm_id: values.trustlines_pm_id,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? 'Failed to save changes');
      }

      const newTypes = (values.categories ?? []).filter(c => !editProject.categories.includes(c));
      let folderMsg = '';
      if (newTypes.length > 0) {
        try {
          const fRes = await fetch(`/api/projects/${editProject.id}/type-folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: newTypes }),
          });
          folderMsg = fRes.ok
            ? ` Dropbox folder${newTypes.length > 1 ? 's' : ''} added for ${newTypes.join(', ')}.`
            : ' (Dropbox folder for the new type is pending — retry from the project page.)';
        } catch {
          folderMsg = ' (Dropbox folder for the new type is pending — retry from the project page.)';
        }
      }

      toast.success(`Project updated.${folderMsg}`);
      router.push(`/projects/${editProject.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const missingVal = selectedCats.filter(c => !(parseFloat(catValues[c] ?? '') > 0));
    if (missingVal.length) {
      toast.error(`Enter an estimated value for: ${missingVal.join(', ')}`);
      setActiveStep(2);
      return;
    }

    if (isEdit) {
      await updateProject(values);
      return;
    }

    if (importSelection) {
      await proceedWithCreate(values, importSelection.dropboxPath);
      return;
    }

    const hasDropboxPath = values.dropbox_section && values.dropbox_region &&
      values.dropbox_status && values.dropbox_client_type;
    if (hasDropboxPath) {
      setIsCheckingDropbox(true);
      try {
        const parentPath = buildDropboxParentPath(values);
        const res = await fetch(
          `/api/dropbox/check-project-number?${new URLSearchParams({
            projectNo: values.project_code.trim(),
            parentPath,
          })}`,
        );
        if (res.ok) {
          const data = await res.json() as { exists: boolean; existingPath?: string; existingName?: string };
          if (data.exists && data.existingPath && data.existingName) {
            setDropboxConflict({ existingPath: data.existingPath, existingName: data.existingName });
            setPendingValues(values);
            setIsCheckingDropbox(false);
            return;
          }
        }
      } catch { }
      setIsCheckingDropbox(false);
    }

    await proceedWithCreate(values, null);
  });

  async function handleDropboxImport(info: DropboxProjectSelection) {
    setImportSelection(info);
    setShowDropboxBrowser(false);

    setValue('name', info.projectName, { shouldValidate: true });
    setValue('project_code', info.projectNo, { shouldValidate: true });
    setValue('site_location', info.address, { shouldValidate: true });

    if (info.detectedCategories.length > 0) {
      const defaultSet = new Set(DEFAULT_CATEGORIES);
      const unknown = info.detectedCategories.filter(c => !defaultSet.has(c));
      if (unknown.length > 0) setExtraCats(prev => [...new Set([...prev, ...unknown])]);
      setSelectedCats(info.detectedCategories);
    }

    setValue('dropbox_section', info.dropboxSection, { shouldValidate: true });
    setValue('dropbox_region', info.dropboxRegion, { shouldValidate: true });
    setValue('dropbox_status', info.dropboxStatus, { shouldValidate: true });
    setValue('dropbox_client_type', info.dropboxClientType, { shouldValidate: true });
    if (info.dropboxClientName) {
      setValue('dropbox_client_name', info.dropboxClientName);
    }

    try {
      const res = await fetch(
        `/api/projects/lookup-dropbox-client?${new URLSearchParams({
          section: info.dropboxSection,
          region: info.dropboxRegion,
        })}`,
      );
      if (res.ok) {
        const match = await res.json() as {
          clientId: string | null;
          franchiseId: string | null;
          companyId: string | null;
        };
        if (match.clientId) {
          setSelectedClientId(match.clientId);
          setValue('client_id', match.clientId, { shouldValidate: true });
        }
        if (match.franchiseId) {
          setSelectedFranchiseId(match.franchiseId);
          setValue('client_franchise_id', match.franchiseId);
        }
        if (match.companyId) {
          setValue('client_company_id', match.companyId);
        }
      }
    } catch { }
  }

  const isBusy = isSubmitting || isCheckingDropbox;

  // Validation / required check calculation for right sidebar progress
  const hasRegion = !!selectedClientId;
  const hasCompany = !!watchedServiceId || isEdit;
  const hasLocation = !!watchedSiteLocation?.trim();
  const completedRequiredCount = [hasRegion, hasCompany, hasLocation].filter(Boolean).length;
  const totalRequiredCount = 3;

  const calculatedTotal = selectedCats.reduce((a, c) => a + (parseFloat(catValues[c] ?? '') || 0), 0);

  const roleLabel = userRole === 'general_manager' ? 'General Manager' : 'Ops Manager';

  return (
    <>
      <style>{`
      .new-project-wrapper {
        display: flex;
        flex-direction: column;
        gap: 20px;
        color: #1e293b;
      }
      .np-top-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      .np-top-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .np-title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0;
        color: #0f172a;
      }
      .np-status-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 9999px;
        background: #f1f5f9;
        color: #64748b;
        font-size: 12px;
        font-weight: 500;
      }
      .np-top-header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .np-user-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 600;
        color: #334155;
      }
      .np-user-avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #3a4869ff
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
      }

      /* Start faster Banner */
      .start-faster-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      }
      .start-faster-label {
        font-weight: 700;
        font-size: 14px;
        color: #0f172a;
        white-space: nowrap;
      }
      .dropbox-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border: 1.5px solid #0f172a
        border-radius: 8px;
        background: #ffffff;
        color: #0f172a;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .dropbox-btn:hover {
        background: #eff6ff;
      }
      .start-faster-input-container {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .start-faster-input {
        width: 100%;
        padding: 8px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13px;
        color: #0f172a;
      }
      .start-faster-input::placeholder {
        color: #94a3b8;
      }
      .extract-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease;
      }
      .extract-btn:hover:not(:disabled) {
        background: #0f172a;
      }
      .extract-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-primary-navy {
        background: #0f172a;
        color: #ffffff !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 8px 18px !important;
        font-weight: 600 !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: background 0.15s ease !important;
      }
      .btn-primary-navy:hover:not(:disabled) {
        background: #0f172a !important;
      }

      /* 3-Column Grid Dashboard */
      .np-dashboard-grid {
        display: grid;
        grid-template-columns: 240px 1fr 280px;
        gap: 20px;
        align-items: start;
      }

      /* Stepper Sidebar */
      .stepper-sidebar {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px 12px;
      }
      .step-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
        position: relative;
        user-select: none;
      }
      .step-icon-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #cbd5e1;
        background: #ffffff;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .step-item.active .step-icon-circle {
        border-color: #0f172a;
        background: #0f172a;
        color: #ffffff;
        box-shadow: 0 0 0 5px #dbeafe;
      }
      .step-item.completed .step-icon-circle {
        border-color: #0f172a
        background: #eff6ff;
        color: #0f172a;
      }
      .step-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .step-title-text {
        font-size: 14px;
        font-weight: 600;
        color: #475569;
      }
      .step-item.active .step-title-text {
        color: #0f172a;
        font-weight: 700;
      }
      .step-subtitle-text {
        font-size: 11.5px;
        color: #94a3b8;
      }

      /* Step Content Card */
      .step-content-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        min-height: 480px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .step-card-header {
        margin-bottom: 20px;
      }
      .step-card-title {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
      .step-card-subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }

      .form-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 16px;
      }
      .form-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 16px;
      }

      /* Form elements customization */
      .input-with-badge {
        position: relative;
        display: flex;
        align-items: center;
      }
      .auto-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: #eff6ff;
        color: #0f172a;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 8px;
      }

      .step-footer-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid #f1f5f9;
      }

      /* Summary Sidebar */
      .summary-sidebar-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      }
      .summary-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f1f5f9;
      }
      .summary-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
      .summary-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      .summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
      }
      .summary-row-key {
        color: #64748b;
      }
      .summary-row-val {
        font-weight: 600;
        color: #0f172a;
        text-align: right;
      }
      .summary-row-val-mono {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
      }

      .summary-footer-box {
        padding-top: 16px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .summary-info-text {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #0f172a;
        background: #eff6ff;
        padding: 8px 12px;
        border-radius: 8px;
      }
      .progress-label-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 6px;
      }
      .progress-bar-bg {
        width: 100%;
        height: 6px;
        background: #e2e8f0;
        border-radius: 9999px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: #0f172a;
        border-radius: 9999px;
        transition: width 0.3s ease;
      }

      .btn-outline-custom {
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
      }
      .btn-outline-custom:hover {
        background: #f8fafc;
      }
    `}</style>

      <form onSubmit={onSubmit} className="new-project-wrapper">
        {/* Top Header Bar */}
        <div className="np-top-header">
          <div className="np-top-header-left">
            <h1 className="np-title">{isEdit ? `Edit project ${editProject?.project_code}` : 'New project'}</h1>
            <span className="np-status-badge">Not saved yet</span>
          </div>
          <div className="np-top-header-right">
            <button
              type="button"
              className="btn-outline-custom"
              onClick={() => router.push(isEdit ? `/projects/${editProject!.id}` : '/projects')}
            >
              Cancel
            </button>
            {!isEdit && (
              <button type="button" className="btn-outline-custom" disabled={isBusy}>
                Save draft
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary-navy"
              disabled={isBusy || !!dropboxConflict}
            >
              {isEdit
                ? (isSubmitting ? 'Saving...' : 'Save changes')
                : (isCheckingDropbox ? 'Checking Dropbox...' : isSubmitting ? 'Creating...' : 'Create project')}
            </button>
            <div className="np-user-badge">
              <span className="np-user-avatar">{roleLabel.slice(0, 2).toUpperCase()}</span>
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* "Start faster" Bar */}
        {!isEdit && (
          <div className="start-faster-card">
            <span className="start-faster-label">Start faster</span>
            <button
              type="button"
              className="dropbox-btn"
              onClick={() => setShowDropboxBrowser(prev => !prev)}
            >
              <Folder size={14} color="#7287b4ff" />
              <span>Browse existing Dropbox projects</span>
            </button>
            <div className="start-faster-input-container">
              <input
                type="text"
                className="start-faster-input"
                placeholder="Paste deal email to auto-fill the form"
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
              />
              <button
                type="button"
                className="extract-btn"
                onClick={handleExtract}
                disabled={isExtracting || !emailText.trim()}
              >
                <Sparkles size={13} />
                <span>{isExtracting ? 'Extracting...' : 'Extract from email'}</span>
              </button>
            </div>
            {extractMsg && (
              <span style={{ fontSize: 12, color: extractMsg.includes('extracted') ? '#16a34a' : '#dc2626' }}>
                {extractMsg}
              </span>
            )}
          </div>
        )}

        {showDropboxBrowser && !isEdit && (
          <div style={{ marginBottom: 16 }}>
            <DropboxProjectBrowser
              onSelect={handleDropboxImport}
              onCancel={() => setShowDropboxBrowser(false)}
            />
          </div>
        )}

        {importSelection && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#166534'
          }}>
            <div>
              <strong>Linked Dropbox Project:</strong> {importSelection.dropboxPath}
            </div>
            <button type="button" onClick={() => setImportSelection(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534', fontWeight: 700 }}>
              ✕ Clear
            </button>
          </div>
        )}

        {/* 3-Column Dashboard Grid */}
        <div className="np-dashboard-grid">
          {/* Left Column: Stepper Sidebar */}
          <div className="stepper-sidebar">
            {WIZARD_STEPS.map((step) => {
              const isActive = activeStep === step.id;
              const isCompleted = activeStep > step.id || (step.id === 1 && hasRegion && hasLocation);

              return (
                <div
                  key={step.id}
                  className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => setActiveStep(step.id)}
                >
                  <div className="step-icon-circle">
                    {isCompleted && !isActive ? <Check size={14} strokeWidth={3} /> : step.id}
                  </div>
                  <div className="step-text">
                    <span className="step-title-text">{step.title}</span>
                    <span className="step-subtitle-text">{step.subtitle}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Middle Column: Active Step Content Card */}
          <div className="step-content-card">
            <div>
              <div className="step-card-header">
                <h2 className="step-card-title">{WIZARD_STEPS[activeStep - 1].title}</h2>
                <p className="step-card-subtitle">
                  {activeStep === 1 && 'Tell us the basics so we can set up your project.'}
                  {activeStep === 2 && 'Select scope categories and enter estimated deal values.'}
                  {activeStep === 3 && 'Set the closed deal date and estimated delivery date.'}
                  {activeStep === 4 && 'Configure Dropbox folder structure and client classification.'}
                  {activeStep === 5 && 'Link ClickUp task and QuickBooks reference if available.'}
                  {activeStep === 6 && 'Assign responsible project managers and QC inspectors.'}
                </p>
              </div>

              {/* STEP 1: Project Info */}
              {activeStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <FieldLabel required>Region</FieldLabel>
                        {!isEdit && (
                          <button
                            type="button"
                            onClick={() => setShowNewClientForm(true)}
                            style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            + Add new region
                          </button>
                        )}
                      </div>
                      <select
                        className="form-input form-select"
                        value={selectedClientId}
                        disabled={isEdit}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__new__') { setShowNewClientForm(true); return; }
                          setSelectedClientId(val);
                          setSelectedFranchiseId('');
                          setValue('client_id', val, { shouldValidate: true });
                          setValue('client_franchise_id', undefined);
                          setValue('client_company_id', undefined);
                          setTrustRegion(regionCodeForClient(localClients.find(c => c.id === val)));
                        }}
                      >
                        <option value="">Select region...</option>
                        {localClients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                        ))}
                      </select>
                      <FieldError msg={errors.client_id?.message} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <FieldLabel required>Company</FieldLabel>
                      <select
                        className="form-input form-select"
                        value={watchedServiceId ?? ''}
                        onChange={e => {
                          setValue('client_franchise_id', undefined);
                          setValue('client_company_id', e.target.value || undefined, { shouldValidate: true });
                        }}
                      >
                        <option value="">Select company...</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                        ))}
                      </select>
                      <span className="form-hint">Choose a Store Maker, Premium, or Design company.</span>
                      <FieldError msg={errors.client_company_id?.message} />
                    </div>
                  </div>

                  {showNewClientForm && (
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14, marginBottom: 8 }}>
                      <div className="form-grid-2" style={{ marginBottom: 10 }}>
                        <div>
                          <label className="form-label required">Region name</label>
                          <input className="form-input" placeholder="e.g. T-Lines North East" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">Code</label>
                          <input className="form-input" placeholder="e.g. NE" value={newClientCode} onChange={e => setNewClientCode(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveClient} disabled={!newClientName.trim() || savingClient}>
                          {savingClient ? 'Saving...' : 'Save region'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewClientForm(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Project Number Field */}
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <FieldLabel required aiField={aiFields.has('project_code')}>Project number</FieldLabel>
                      <span className="auto-badge">⚡ Auto</span>
                    </div>
                    <input
                      className="form-input"
                      readOnly={autoCodeMode}
                      value={watchedCode ?? ''}
                      placeholder="-- -- --"
                      style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em', maxWidth: 260, background: autoCodeMode ? '#f8fafc' : '#fff' }}
                      {...register('project_code')}
                    />
                    <span className="form-hint">Pick a Region and Company to generate automatically, or leave empty to type manually.</span>
                    <FieldError msg={errors.project_code?.message} />
                  </div>

                  {/* Find Location (US) Section */}
                  <div style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Find location (US)</h3>
                    <div className="form-grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <FieldLabel required>State</FieldLabel>
                        <select
                          className="form-input form-select"
                          value={searchState}
                          onChange={e => setSearchState(e.target.value)}
                        >
                          <option value="">Select state...</option>
                          {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <FieldLabel required>City or full street address</FieldLabel>
                        <LocationSearch
                          stateAbbr={searchState}
                          placeholder="Search city or enter full street address"
                          onSelect={r => {
                            const num = (watch('project_code') ?? '').trim();
                            const loc = [r.city, r.street, r.stateAbbr].map(x => (x ?? '').trim()).filter(Boolean).join(' - ') || r.label;
                            setValue('site_location', loc, { shouldValidate: true });
                            setValue('name', num ? `${num} - ${loc}` : loc, { shouldValidate: true });
                          }}
                        />
                      </div>
                    </div>
                    <span className="form-hint" style={{ marginTop: 6, display: 'block' }}>
                      Pick the state, then type a city or full street address to get the exact address with ZIP. This will auto-fill the Project name and Site / location.
                    </span>
                  </div>

                  <div className="form-grid-3" style={{ marginTop: 8 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <FieldLabel required aiField={aiFields.has('name')}>Project name</FieldLabel>
                      <input className="form-input" placeholder="Auto-filled from location" {...register('name')} />
                      <FieldError msg={errors.name?.message} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <FieldLabel required aiField={aiFields.has('closed_deal_date')}>Closed-deal date</FieldLabel>
                      <input className="form-input" type="date" {...register('closed_deal_date')} />
                      <FieldError msg={errors.closed_deal_date?.message} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <FieldLabel required aiField={aiFields.has('site_location')}>Site / location</FieldLabel>
                      <input className="form-input" placeholder="Auto-filled from address" {...register('site_location')} />
                      <FieldError msg={errors.site_location?.message} />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Categories & Value */}
              {activeStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FieldLabel required>Select Project Categories</FieldLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                    {[...DEFAULT_CATEGORIES, ...extraCats].map(cat => {
                      const selected = selectedCats.includes(cat);
                      return (
                        <div
                          key={cat}
                          onClick={() => toggleCat(cat)}
                          style={{
                            padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            border: `1.5px solid ${selected ? '#2563eb' : '#cbd5e1'}`,
                            background: selected ? '#eff6ff' : '#ffffff',
                            color: selected ? '#2563eb' : '#475569',
                            display: 'inline-flex', alignItems: 'center', gap: 6
                          }}
                        >
                          {selected && <Check size={12} strokeWidth={3} />}
                          {cat}
                        </div>
                      );
                    })}
                    {SHOW_CUSTOM_CATEGORY && (
                      showCustomInput ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            className="form-input" style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                            placeholder="Category name" value={customCatInput}
                            onChange={e => setCustomCatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCat(); } }}
                            autoFocus
                          />
                          <button type="button" className="btn btn-primary btn-sm" onClick={addCustomCat}>Add</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => setShowCustomInput(true)}
                          style={{ padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, border: '1.5px dashed #cbd5e1', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Plus size={13} /> Add category
                        </div>
                      )
                    )}
                  </div>

                  {selectedCats.length > 0 && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>Category Estimated Values</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {selectedCats.map(cat => (
                          <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, minWidth: 100 }}>{cat}</span>
                            <input
                              className="form-input" type="text" inputMode="decimal" placeholder="Est. Value"
                              value={formatThousands(catValues[cat] ?? '')}
                              onChange={e => setCatValues(v => ({ ...v, [cat]: sanitizeAmount(e.target.value) }))}
                              style={{ flex: 1, fontSize: 13 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-grid-2" style={{ marginTop: 12 }}>
                    <div className="form-group">
                      <FieldLabel>Currency</FieldLabel>
                      <select className="form-input form-select" {...register('currency')}>
                        <option value="USD">USD — US Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="TRY">TRY — Turkish Lira</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Deal Value</span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                        {watchedCurrency} {calculatedTotal.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Timeline */}
              {activeStep === 3 && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <FieldLabel required aiField={aiFields.has('closed_deal_date')}>Closed-deal date</FieldLabel>
                    <input className="form-input" type="date" {...register('closed_deal_date')} />
                  </div>
                  <div className="form-group">
                    <FieldLabel required>Estimated delivery date</FieldLabel>
                    <input className="form-input" type="date" {...register('est_delivery_date')} />
                    <FieldError msg={errors.est_delivery_date?.message} />
                  </div>
                </div>
              )}

              {/* STEP 4: Dropbox Folder */}
              {activeStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <FieldLabel>Client Name (Optional)</FieldLabel>
                    <input
                      className="form-input"
                      placeholder="e.g. SPEEDY — leave empty for Individual project"
                      {...register('dropbox_client_name')}
                    />
                  </div>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: '#475569' }}>
                    /D-Projects/T LINES/{watch('dropbox_section') || '1-Store Maker'}/{watch('dropbox_region') || 'T Lines NE Projects'}/Under Working/
                    {watch('dropbox_client_type') === 'Clients' ? 'Clients' : 'Individiuals'}
                    {watch('dropbox_client_type') === 'Clients' && watch('dropbox_client_name') ? `/${watch('dropbox_client_name')}` : ''}
                    /{watchedCode || '{number}'} - {watchedSiteLocation || '{location}'}
                  </div>
                </div>
              )}

              {/* STEP 5: Integrations */}
              {activeStep === 5 && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <FieldLabel>ClickUp Task ID</FieldLabel>
                    <input className="form-input" placeholder="Paste ClickUp task ID" {...register('clickup_task_id')} />
                  </div>
                  <div className="form-group">
                    <FieldLabel>QuickBooks Reference</FieldLabel>
                    <input className="form-input" placeholder="QuickBooks reference" {...register('quickbooks_ref')} />
                  </div>
                </div>
              )}

              {/* STEP 6: Initial Team */}
              {activeStep === 6 && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <FieldLabel required>Trust-Lines PM</FieldLabel>
                    <select className="form-input form-select" {...register('trustlines_pm_id')}>
                      <option value="">Select Trust-Lines PM...</option>
                      {trustlinesPmProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.trustlines_pm_id?.message} />
                  </div>

                  <div className="form-group">
                    <FieldLabel required>Client PM (T-Lines)</FieldLabel>
                    <select className="form-input form-select" {...register('tlines_pm_id')}>
                      <option value="">Select T-Lines PM...</option>
                      {tlinesPmProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.tlines_pm_id?.message} />
                  </div>
                </div>
              )}
            </div>

            {/* Card Footer Step Navigation */}
            <div className="step-footer-actions">
              {activeStep > 1 && (
                <button
                  type="button"
                  className="btn-outline-custom"
                  onClick={() => setActiveStep(s => s - 1)}
                >
                  ← Back
                </button>
              )}
              {activeStep < 6 ? (
                <button
                  type="button"
                  className="btn btn-primary-navy"
                  onClick={() => setActiveStep(s => s + 1)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>Continue to {WIZARD_STEPS[activeStep]?.title}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary-navy"
                  disabled={isBusy || !!dropboxConflict}
                >
                  {isEdit ? 'Save changes' : 'Create project'}
                </button>
              )}
              <button
                type="button"
                className="btn-outline-custom"
                onClick={() => router.push('/projects')}
                style={{ marginLeft: 'auto' }}
              >
                Save and exit
              </button>
            </div>
          </div>

          {/* Right Column: Project summary Panel */}
          <div className="summary-sidebar-card">
            <div className="summary-head">
              <h3 className="summary-title">Project summary</h3>
              <span className="np-status-badge">Not saved yet</span>
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span className="summary-row-key">Project number</span>
                <span className="summary-row-val">{watchedCode || 'Pending'}</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Region</span>
                <span className="summary-row-val">{selectedClient?.name || 'Not selected'}</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Company</span>
                <span className="summary-row-val">{selectedCompany?.name || 'Not selected'}</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Categories</span>
                <span className="summary-row-val">{selectedCats.length > 0 ? selectedCats.join(', ') : 'None'}</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Total deal value</span>
                <span className="summary-row-val">{watchedCurrency} {calculatedTotal.toLocaleString('en-US')}</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Dropbox folder</span>
                <span className="summary-row-val summary-row-val-mono">—</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Status</span>
                <span className="summary-row-val">Under Working</span>
              </div>

              <div className="summary-row">
                <span className="summary-row-key">Client type</span>
                <span className="summary-row-val">{watch('dropbox_client_type') || 'Individuals'}</span>
              </div>
            </div>

            <div className="summary-footer-box">
              <div className="summary-info-text">
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>Select Region, Company and location to continue</span>
              </div>

              <div>
                <div className="progress-label-row">
                  <span>{completedRequiredCount} of {totalRequiredCount} required fields</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(completedRequiredCount / totalRequiredCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
