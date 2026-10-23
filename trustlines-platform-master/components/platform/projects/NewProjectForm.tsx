'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { newProjectSchema, type NewProjectFormValues } from '@/lib/validations/project';
import { DropboxProjectBrowser, type DropboxProjectSelection } from './DropboxProjectBrowser';
import type { GeoResult } from './LocationSearch';
import { composeProjectCode, dropboxRegionFolder } from '@/lib/regions';
import {
  DEFAULT_CATEGORIES, WIZARD_STEPS, regionCodeForClient, sectionFromService, serviceLineFromCompanyName,
  type ClientRow, type PmProfileRow, type ProfileRow,
} from './new-project/helpers';
import { NEW_PROJECT_STYLES } from './new-project/styles';
import type { FormHandles } from './new-project/formTypes';
import { StartFasterBar } from './new-project/StartFasterBar';
import { StepperSidebar } from './new-project/StepperSidebar';
import { Step1ProjectInfo } from './new-project/Step1ProjectInfo';
import { Step2CategoriesValue } from './new-project/Step2CategoriesValue';
import { Step3Timeline } from './new-project/Step3Timeline';
import { Step4DropboxFolder } from './new-project/Step4DropboxFolder';
import { Step5Integrations } from './new-project/Step5Integrations';
import { Step6InitialTeam } from './new-project/Step6InitialTeam';
import { SummaryPanel } from './new-project/SummaryPanel';
import { feedback } from '@/components/ui/feedback-toast';

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
  // Quick Creation is open on step 1 and folds to its title row on later steps (Figma).
  const [quickOpen, setQuickOpen] = useState(true);
  useEffect(() => { setQuickOpen(activeStep === 1); }, [activeStep]);

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

      feedback.success('Project created', { description: `${code} is ready.${dropboxMsg}` });
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

      feedback.success('Changes saved', { description: `The project is up to date.${folderMsg}` });
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

  function handleRegionChange(val: string) {
    setSelectedClientId(val);
    setSelectedFranchiseId('');
    setValue('client_id', val, { shouldValidate: true });
    setValue('client_franchise_id', undefined);
    setValue('client_company_id', undefined);
    setTrustRegion(regionCodeForClient(localClients.find(c => c.id === val)));
  }

  function handleLocationSelect(r: GeoResult) {
    const num = (watch('project_code') ?? '').trim();
    const loc = [r.city, r.street, r.stateAbbr].map(x => (x ?? '').trim()).filter(Boolean).join(' - ') || r.label;
    setValue('site_location', loc, { shouldValidate: true });
    setValue('name', num ? `${num} - ${loc}` : loc, { shouldValidate: true });
  }

  function cancel() {
    router.push(isEdit ? `/projects/${editProject!.id}` : '/projects');
  }

  const formHandles: FormHandles = { register, setValue, watch, errors };

  return (
    <>
      <style>{NEW_PROJECT_STYLES}</style>

      <form onSubmit={onSubmit} className="new-project-wrapper">
        {/* Page heading (Figma Project Detail) */}
        <div className="np-top-header">
          <div className="np-top-header-left">
            <h1 className="np-title">{isEdit ? `Edit Project ${editProject?.project_code}` : 'New Project'}</h1>
            <p className="np-subtitle">
              {isEdit
                ? `${roleLabel} · Changes apply once you save on the last step or with Save & exit.`
                : `${roleLabel} · Creating the project reserves its project number and sets up its Dropbox folders.`}
            </p>
          </div>
          <button type="button" className="np-cancel-btn" onClick={cancel}>
            <Trash2 size={16} aria-hidden />
            Cancel
          </button>
        </div>

        {/* "Start faster" Bar */}
        {!isEdit && (
          <StartFasterBar
            open={quickOpen}
            onToggleOpen={() => setQuickOpen(o => !o)}
            emailText={emailText}
            setEmailText={setEmailText}
            isExtracting={isExtracting}
            extractMsg={extractMsg}
            onExtract={handleExtract}
            onToggleDropboxBrowser={() => setShowDropboxBrowser(prev => !prev)}
          />
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
            background: 'var(--status-success-bg)', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--status-success-fg)'
          }}>
            <div>
              <strong>Linked Dropbox Project:</strong> {importSelection.dropboxPath}
            </div>
            <button type="button" onClick={() => setImportSelection(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--status-success-fg)', fontWeight: 700 }}>
              ✕ Clear
            </button>
          </div>
        )}

        {/* Form progress, then the active step card + Project Summary */}
        <div className="np-body">
          <StepperSidebar activeStep={activeStep} step1Complete={hasRegion && hasLocation} onSelect={setActiveStep} />

          <div className="np-main-grid">
          <div className="np-card step-content-card">
            <div>
              <div className="step-card-header">
                <h2 className="np-card-title">{WIZARD_STEPS[activeStep - 1].title}</h2>
              </div>

              {activeStep === 1 && (
                <Step1ProjectInfo
                  form={formHandles}
                  isEdit={isEdit}
                  aiFields={aiFields}
                  autoCodeMode={autoCodeMode}
                  watchedCode={watchedCode}
                  watchedServiceId={watchedServiceId}
                  localClients={localClients}
                  companies={companies}
                  selectedClientId={selectedClientId}
                  onRegionChange={handleRegionChange}
                  onLocationSelect={handleLocationSelect}
                  searchState={searchState}
                  setSearchState={setSearchState}
                  showNewClientForm={showNewClientForm}
                  setShowNewClientForm={setShowNewClientForm}
                  newClientName={newClientName}
                  setNewClientName={setNewClientName}
                  newClientCode={newClientCode}
                  setNewClientCode={setNewClientCode}
                  savingClient={savingClient}
                  onSaveClient={handleSaveClient}
                />
              )}

              {activeStep === 2 && (
                <Step2CategoriesValue
                  form={formHandles}
                  extraCats={extraCats}
                  selectedCats={selectedCats}
                  onToggleCat={toggleCat}
                  showCustomInput={showCustomInput}
                  setShowCustomInput={setShowCustomInput}
                  customCatInput={customCatInput}
                  setCustomCatInput={setCustomCatInput}
                  onAddCustomCat={addCustomCat}
                  catValues={catValues}
                  setCatValues={setCatValues}
                  watchedCurrency={watchedCurrency}
                  calculatedTotal={calculatedTotal}
                />
              )}

              {activeStep === 3 && <Step3Timeline form={formHandles} aiFields={aiFields} />}

              {activeStep === 4 && (
                <Step4DropboxFolder form={formHandles} watchedCode={watchedCode} watchedSiteLocation={watchedSiteLocation} />
              )}

              {activeStep === 5 && <Step5Integrations form={formHandles} />}

              {activeStep === 6 && (
                <Step6InitialTeam
                  form={formHandles}
                  trustlinesPmProfiles={trustlinesPmProfiles}
                  tlinesPmProfiles={tlinesPmProfiles}
                />
              )}
            </div>

            {/* Card Footer Step Navigation */}
            <div className="step-footer-actions">
              {activeStep > 1 ? (
                <button
                  type="button"
                  className="btn-outline-custom muted"
                  onClick={() => setActiveStep(s => s - 1)}
                >
                  <ArrowLeft size={14} aria-hidden /> Back
                </button>
              ) : (
                <button type="button" className="btn-outline-custom muted" onClick={cancel}>
                  Cancel
                </button>
              )}
              <div className="step-footer-right">
                {isEdit ? (
                  <button type="submit" className="btn-outline-custom" disabled={isBusy}>
                    {isSubmitting ? 'Saving...' : 'Save & exit'}
                  </button>
                ) : (
                  <button type="button" className="btn-outline-custom" onClick={() => router.push('/projects')}>
                    Save &amp; exit
                  </button>
                )}
                {activeStep < WIZARD_STEPS.length ? (
                  <button
                    type="button"
                    className="btn-primary-navy"
                    onClick={() => setActiveStep(s => s + 1)}
                    title={`Continue to ${WIZARD_STEPS[activeStep]?.title}`}
                  >
                    <span>Next</span>
                    <ArrowRight size={14} aria-hidden />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn-primary-navy"
                    disabled={isBusy || !!dropboxConflict}
                  >
                    {isEdit
                      ? (isSubmitting ? 'Saving...' : 'Save changes')
                      : (isCheckingDropbox ? 'Checking Dropbox...' : isSubmitting ? 'Creating...' : 'Create project')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Project summary Panel */}
          <SummaryPanel
            watchedCode={watchedCode}
            regionName={selectedClient?.name}
            companyName={selectedCompany?.name}
            selectedCats={selectedCats}
            watchedCurrency={watchedCurrency}
            calculatedTotal={calculatedTotal}
            clientType={watch('dropbox_client_type')}
            completedRequiredCount={completedRequiredCount}
            totalRequiredCount={totalRequiredCount}
          />
          </div>
        </div>
      </form>
    </>
  );
}
