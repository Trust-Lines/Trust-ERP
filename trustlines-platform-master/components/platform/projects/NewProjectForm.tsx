'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Check, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { newProjectSchema, type NewProjectFormValues } from '@/lib/validations/project';
import { DropboxProjectBrowser, type DropboxProjectSelection } from './DropboxProjectBrowser';
import { LocationSearch } from './LocationSearch';
import { US_STATES } from '@/lib/usStates';
import { REGIONS, composeProjectCode, dropboxRegionFolder } from '@/lib/regions';


interface ProfileRow { id: string; full_name: string }
interface PmProfileRow extends ProfileRow { pm_client_id?: string | null; is_pm_supervisor?: boolean }
interface ClientRow  { id: string; name: string; code: string | null }



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
  clients: ClientRow[];
  tlinesPmProfiles: PmProfileRow[];
  trustlinesPmProfiles: ProfileRow[];
  qcProfiles: ProfileRow[];
  allFranchises: { id: string; name: string; code: string | null; client_id: string }[];
  allCompanies:  { id: string; name: string; code: string | null; client_id: string | null }[];

  editProject?: EditProjectData;
}


const DEFAULT_CATEGORIES = ['Millwork', 'Shelving', 'Image', 'Ceiling', 'Furniture', 'Decoration'];

const SHOW_CUSTOM_CATEGORY = false;


function sectionFromService(name?: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('store maker')) return '1-Store Maker';
  if (n.includes('premium'))     return '2-Premium Store Fitout';
  if (n.includes('design'))      return '3-Design & Build';
  if (n.includes('shop'))        return '4-T Shop';
  return '';
}




function serviceLineFromCompanyName(name?: string | null): string | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('store maker')) return 'store_maker';
  if (n.includes('premium'))     return 'premium_store_fitout';
  if (n.includes('design'))      return 'design_build';
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


export function NewProjectForm({
  currentUserId,
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


  const [emailText, setEmailText]       = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractMsg, setExtractMsg]     = useState('');
  const [aiFields, setAiFields]         = useState<Set<string>>(new Set());


  const [selectedClientId, setSelectedClientId]         = useState(editProject?.client_id ?? '');
  const [, setSelectedFranchiseId]                      = useState('');
  const [showNewClientForm, setShowNewClientForm]       = useState(false);
  const [newClientName, setNewClientName]               = useState('');
  const [newClientCode, setNewClientCode]               = useState('');
  const [savingClient, setSavingClient]                 = useState(false);
  const [localClients, setLocalClients]                 = useState<ClientRow[]>(clients);


  const companies  = allCompanies.filter(c => c.client_id === selectedClientId);
  const editCompany = allCompanies.find(c => c.id === editProject?.client_company_id) ?? null;

  const regionalPm = tlinesPmProfiles.find(p => p.pm_client_id === selectedClientId) ?? null;
  const supervisor = tlinesPmProfiles.find(p => p.is_pm_supervisor) ?? null;


  const [selectedCats, setSelectedCats]         = useState<string[]>(editProject?.categories ?? []);
  const [customCatInput, setCustomCatInput]     = useState('');
  const [showCustomInput, setShowCustomInput]   = useState(false);
  const [extraCats, setExtraCats]               = useState<string[]>(
    () => (editProject?.categories ?? []).filter(c => !DEFAULT_CATEGORIES.includes(c)),
  );

  const [catValues, setCatValues]               = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(editProject?.category_values ?? {})) out[k] = String(v);
    return out;
  });

  const [searchState, setSearchState]           = useState('');



  const [trustRegion, setTrustRegion]           = useState(
    () => editProject ? regionCodeForClient(clients.find(c => c.id === editProject.client_id)) : '',
  );
  const [trustAutoNumber, setTrustAutoNumber]   = useState<number | null>(null);


  const [showDropboxBrowser, setShowDropboxBrowser]   = useState(false);
  const [importSelection, setImportSelection]         = useState<DropboxProjectSelection | null>(null);


  const [isSubmitting, setIsSubmitting]   = useState(false);
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
          name:              editProject.name,
          project_code:      editProject.project_code,
          client_id:         editProject.client_id,
          client_company_id: editProject.client_company_id ?? undefined,
          site_location:     editProject.site_location,
          closed_deal_date:  editProject.closed_deal_date,
          est_delivery_date: editProject.est_delivery_date,
          categories:        editProject.categories,
          deal_value:        editProject.deal_value ?? undefined,
          currency:          editProject.currency,
          clickup_task_id:   editProject.clickup_task_id ?? undefined,
          quickbooks_ref:    editProject.quickbooks_ref ?? undefined,
          tlines_pm_id:      editProject.tlines_pm_id ?? '',
          trustlines_pm_id:  editProject.trustlines_pm_id ?? '',


          dropbox_section:     '(unchanged)',
          dropbox_region:      '(unchanged)',
          dropbox_status:      'Under Working',
          dropbox_client_type: editProject.dropbox_root_path?.includes('/Individiuals/') ? 'Individuals' : 'Clients',
        }
      : { currency: 'USD' },
  });

  const watchedCode = watch('project_code');

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
    const sup      = tlinesPmProfiles.find(p => p.is_pm_supervisor);
    setValue('tlines_pm_id', regional?.id ?? sup?.id ?? '', { shouldValidate: true });
  }, [isEdit, selectedClientId, tlinesPmProfiles, setValue]);





  const watchedServiceId  = watch('client_company_id');
  const watchedClientName = watch('dropbox_client_name');




  const selectedCompany   = allCompanies.find(c => c.id === watchedServiceId);
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
     
  }, [autoCodeMode]);


  useEffect(() => {
    if (autoCodeMode && trustAutoNumber != null) {
      setValue('project_code', composeProjectCode(derivedServiceLine, trustRegion, trustAutoNumber), { shouldValidate: true });
    }
     
  }, [autoCodeMode, trustAutoNumber, trustRegion, derivedServiceLine]);


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

      if (fields.project_name)     { setValue('name', String(fields.project_name));                       filled.add('name');             count++; }
      if (fields.project_code)     { setValue('project_code', String(fields.project_code), { shouldValidate: true }); filled.add('project_code'); count++; }
      if (fields.closed_deal_date) { setValue('closed_deal_date', String(fields.closed_deal_date));       filled.add('closed_deal_date'); count++; }
      if (fields.site_location)    { setValue('site_location', String(fields.site_location));              filled.add('site_location');    count++; }
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
        setExtractMsg(`${count} field${count > 1 ? 's' : ''} extracted. Review and correct if needed.`);
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
          name:                finalName,
          client_id:           values.client_id,
          client_franchise_id: values.client_franchise_id ?? null,
          client_company_id:   values.client_company_id ?? null,


          ...(regionForInsert ? { region: regionForInsert, service_line: serviceLineForInsert } : {}),
          site_location:       values.site_location,
          closed_deal_date:    values.closed_deal_date,
          categories:          values.categories,
          deal_value:          values.deal_value ?? null,
          currency:            values.currency,
          est_delivery_date:   values.est_delivery_date,
          clickup_task_id:     values.clickup_task_id || null,
          quickbooks_ref:      values.quickbooks_ref || null,
          trustlines_pm_id:    values.trustlines_pm_id,
          tlines_pm_id:        values.tlines_pm_id,
          qc_inspector_id:     null,
          ops_manager_id:      currentUserId,
          created_by:          currentUserId,
          current_stage:       'closed_deal',
          current_phase:       'finalization',
          dropbox_root_path:   dropboxRootPath,
          is_archived:         false,
          hard_deadline:       false,
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
              dropboxSection:    values.dropbox_section,
              dropboxRegion:     values.dropbox_region,
              dropboxStatus:     values.dropbox_status,
              dropboxClientType: values.dropbox_client_type,
              dropboxClientName,
              projectNo:         code,
              address:           values.site_location,
              categories:        values.categories ?? [],
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
        actor_id:   currentUserId,
        action:     'project.created',
        new_value:  { name: values.name, code, categories: values.categories,
                      importedFromDropbox: !!importFromDropboxPath },
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
          name:              values.name,
          site_location:     values.site_location,
          closed_deal_date:  values.closed_deal_date,
          est_delivery_date: values.est_delivery_date,
          categories:        values.categories,
          category_values:   catVals,
          deal_value:        values.deal_value ?? null,
          currency:          values.currency,
          clickup_task_id:   values.clickup_task_id || null,
          quickbooks_ref:    values.quickbooks_ref || null,
          tlines_pm_id:      values.tlines_pm_id,
          trustlines_pm_id:  values.trustlines_pm_id,
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
            projectNo:  values.project_code.trim(),
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


    setValue('name',          info.projectName, { shouldValidate: true });
    setValue('project_code',  info.projectNo,   { shouldValidate: true });
    setValue('site_location', info.address,      { shouldValidate: true });


    if (info.detectedCategories.length > 0) {

      const defaultSet = new Set(DEFAULT_CATEGORIES);
      const unknown = info.detectedCategories.filter(c => !defaultSet.has(c));
      if (unknown.length > 0) setExtraCats(prev => [...new Set([...prev, ...unknown])]);
      setSelectedCats(info.detectedCategories);
    }


    setValue('dropbox_section',     info.dropboxSection,    { shouldValidate: true });
    setValue('dropbox_region',      info.dropboxRegion,     { shouldValidate: true });
    setValue('dropbox_status',      info.dropboxStatus,     { shouldValidate: true });
    setValue('dropbox_client_type', info.dropboxClientType, { shouldValidate: true });
    if (info.dropboxClientName) {
      setValue('dropbox_client_name', info.dropboxClientName);
    }


    try {
      const res = await fetch(
        `/api/projects/lookup-dropbox-client?${new URLSearchParams({
          section: info.dropboxSection,
          region:  info.dropboxRegion,
        })}`,
      );
      if (res.ok) {
        const match = await res.json() as {
          clientId:    string | null;
          franchiseId: string | null;
          companyId:   string | null;
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

  return (
    <>
    <style>{`
      .dbx-spinner {
        display: inline-block;
        width: 16px; height: 16px;
        border: 2px solid var(--border-default);
        border-top: 2px solid var(--brand-teal);
        border-radius: 50%;
        animation: dbx-spin 0.7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes dbx-spin { to { transform: rotate(360deg); } }
    `}</style>
    <form onSubmit={onSubmit} style={{ position: 'relative' }}>
      <div className="form-section-stack">


        {isEdit && (
          <div className="info-box" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', fontSize: 13, lineHeight: 1.5 }}>
            Editing <strong>{editProject!.project_code}</strong>. Region, Company, the project code and the Dropbox folder are locked — you can change everything else, add types, and reassign people.
          </div>
        )}


        {!isEdit && (
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowDropboxBrowser(prev => !prev)}
            style={{ marginBottom: showDropboxBrowser ? 10 : 0 }}
          >
            {showDropboxBrowser
              ? 'Browse existing Dropbox projects ↑'
              : 'Browse existing Dropbox projects ↓'}
          </button>

          {showDropboxBrowser && (
            <DropboxProjectBrowser
              onSelect={handleDropboxImport}
              onCancel={() => setShowDropboxBrowser(false)}
            />
          )}
        </div>
        )}


        {importSelection && (
          <div className="info-box" style={{
            background: 'color-mix(in srgb, var(--status-success) 10%, transparent)',
            borderColor: 'var(--status-success)',
            color:       'var(--status-success-fg)',
            display:     'flex',
            alignItems:  'flex-start',
            gap:         10,
          }}>
            <span>✓</span>
            <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
              <strong>Importing from Dropbox:</strong>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {importSelection.dropboxPath}
              </span>
              {' '}— no folders will be created.
              {importSelection.detectedCategories.length > 0 ? (
                <span style={{ display: 'block', marginTop: 4, color: 'var(--status-success)' }}>
                  ✓ Categories auto-selected: {importSelection.detectedCategories.join(', ')}
                </span>
              ) : (
                <span style={{ display: 'block', marginTop: 4, color: 'var(--status-warning)' }}>
                  ⚠ Categories not detected for this project — please select manually below.
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setImportSelection(null)}
              style={{
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                color:      'var(--status-success-fg)',
                fontSize:   14,
                lineHeight: 1,
                padding:    '0 2px',
                flexShrink: 0,
              }}
              aria-label="Clear import"
            >
              ✕
            </button>
          </div>
        )}


        {!isEdit && (
        <div className="ai-parser-card">
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Paste deal email to auto-fill the form</label>
            <textarea
              className="form-input"
              rows={4}
              style={{ resize: 'vertical', minHeight: 100 }}
              placeholder="Paste the closed-deal email from T-Lines here..."
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={handleExtract}
              disabled={isExtracting || !emailText.trim()}
            >
              <Sparkles size={13} />
              {isExtracting ? 'Extracting...' : 'Extract from email'}
            </button>
            {extractMsg && (
              <span style={{
                fontSize: 12,
                color: extractMsg.startsWith('Could not') ? 'var(--status-danger)' : 'var(--status-success)',
              }}>
                {extractMsg}
              </span>
            )}
          </div>
        </div>
        )}


        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Section 1</div>
              <div className="form-section-title">Project info</div>
            </div>
          </div>
          <div className="card-body">

            <div className="form-group">
              <FieldLabel required>Region</FieldLabel>
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
                style={{ maxWidth: 360, ...(isEdit ? { background: 'var(--bg-subtle)', cursor: 'not-allowed' } : {}) }}
              >
                <option value="">Select region...</option>
                {localClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                ))}
                {!isEdit && <option value="__new__">+ Add new region</option>}
              </select>
              <div className="form-hint">
                {isEdit
                  ? 'Region is locked — it defines the project code and Dropbox folder, which stay fixed.'
                  : 'Pick a Region, then a Company (Store Maker / Premium / Design) below → the project code is generated automatically. Leave the code empty to type it manually.'}
              </div>
              <FieldError msg={errors.client_id?.message} />
            </div>


            {showNewClientForm && (
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
                <div className="form-row" style={{ marginBottom: 12 }}>
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


            {isEdit ? (
              <div className="form-group">
                <FieldLabel>Company</FieldLabel>
                <input
                  className="form-input"
                  readOnly
                  value={editCompany?.name ?? '—'}
                  style={{ maxWidth: 360, background: 'var(--bg-subtle)', cursor: 'not-allowed' }}
                />
                <div className="form-hint">Locked — part of the project code &amp; Dropbox folder.</div>
              </div>
            ) : selectedClientId && companies.length > 0 && (
              <div className="form-group" style={{ transition: 'opacity 200ms' }}>
                <FieldLabel>Company</FieldLabel>
                <select
                  className="form-input form-select"
                  value={watchedServiceId ?? ''}
                  onChange={e => { setValue('client_franchise_id', undefined); setValue('client_company_id', e.target.value || undefined); }}
                >
                  <option value="">Select company... (Store Maker, Premium Fitout…)</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                  ))}
                </select>
              </div>
            )}


            {selectedClientId && isEdit && (
              <div className="form-group" style={{ marginTop: 4 }}>
                <FieldLabel required>Client PM (T-Lines)</FieldLabel>
                <select className="form-input form-select" {...register('tlines_pm_id')} style={{ maxWidth: 360 }}>
                  <option value="">Select T-Lines PM...</option>
                  {tlinesPmProfiles
                    .filter(p => p.pm_client_id === selectedClientId || p.is_pm_supervisor)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}{p.is_pm_supervisor ? ' — General PM' : ' — Region PM'}
                      </option>
                    ))}
                </select>
                <FieldError msg={errors.tlines_pm_id?.message} />
              </div>
            )}
            {selectedClientId && !isEdit && (
              <div className="form-group" style={{ marginTop: 4 }}>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Project management · auto-assigned</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    <b>Client PM:</b>{' '}
                    {regionalPm
                      ? <>{regionalPm.full_name} <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>· region PM</span></>
                      : supervisor
                        ? <>{supervisor.full_name} <span style={{ fontSize: 11, color: 'var(--status-warning)' }}>· no region PM set → using General PM</span></>
                        : <span style={{ color: 'var(--status-danger)' }}>none available</span>}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>
                    <b>Supervisor:</b>{' '}
                    {supervisor
                      ? <>{supervisor.full_name} <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>· General PM (oversees all regions)</span></>
                      : <span style={{ color: 'var(--fg-faint)' }}>none set</span>}
                  </div>
                </div>
                {!regionalPm && !supervisor && (
                  <div className="form-hint">No PM available. <a href="/team" style={{ color: 'var(--brand-teal)' }}>Assign one in Team →</a></div>
                )}

                <input type="hidden" {...register('tlines_pm_id')} />
                <FieldError msg={errors.tlines_pm_id?.message} />
              </div>
            )}

            {isEdit ? (
              <div className="form-group">
                <FieldLabel required>Project code</FieldLabel>
                <input
                  className="form-input"
                  readOnly
                  value={watchedCode ?? ''}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', maxWidth: 200, background: 'var(--bg-subtle)', cursor: 'not-allowed' }}
                />
                <div className="form-hint">Locked — the project code can&apos;t change after creation.</div>
                <FieldError msg={errors.project_code?.message} />
              </div>
            ) : autoCodeMode ? (
              <div className="form-group">
                <FieldLabel required>Project code</FieldLabel>
                <input
                  className="form-input"
                  readOnly
                  value={watchedCode ?? ''}
                  placeholder="Calculating…"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', maxWidth: 200, background: 'var(--bg-subtle)', cursor: 'not-allowed' }}
                />
                <div className="form-hint">Auto-generated from Company + Region (e.g. <b>STW 460</b>).</div>
                <FieldError msg={errors.project_code?.message} />
              </div>
            ) : (
              <div className="form-group">
                <FieldLabel required aiField={aiFields.has('project_code')}>Project number</FieldLabel>
                <input
                  className="form-input"
                  placeholder="e.g. 343"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', maxWidth: 200 }}
                  {...register('project_code')}
                />
                {trustRegion && !derivedServiceLine && (
                  <div className="form-hint">Pick a Company that maps to Store Maker / Premium / Design above to auto-generate the code.</div>
                )}
                <FieldError msg={errors.project_code?.message} />
              </div>
            )}


            <div className="form-group">
              <FieldLabel>Find location (US)</FieldLabel>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <select
                  className="form-input form-select"
                  style={{ width: 150, flexShrink: 0 }}
                  value={searchState}
                  onChange={e => setSearchState(e.target.value)}
                >
                  <option value="">State…</option>
                  {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                </select>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <LocationSearch
                    stateAbbr={searchState}
                    placeholder="City OR full street address — e.g. 199 S Highland Ave Briarcliff"
                    onSelect={r => {
                      const num = (watch('project_code') ?? '').trim();

                      const loc = [r.city, r.street, r.stateAbbr].map(x => (x ?? '').trim()).filter(Boolean).join(' - ') || r.label;
                      setValue('site_location', loc, { shouldValidate: true });
                      setValue('name', num ? `${num} - ${loc}` : loc, { shouldValidate: true });
                    }}
                  />
                </div>
              </div>
              <div className="form-hint">Pick the state, then type a city or a <b>full street address</b> (house number + street) to get the exact address with ZIP. Auto-fills the name &amp; site location.</div>
            </div>

            <div className="form-group">
              <FieldLabel required aiField={aiFields.has('name')}>Project name</FieldLabel>
              <input className="form-input" placeholder="e.g. 343 - Webster City, IA" {...register('name')} />
              <FieldError msg={errors.name?.message} />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <FieldLabel required aiField={aiFields.has('closed_deal_date')}>Closed-deal date</FieldLabel>
                <input className="form-input" type="date" {...register('closed_deal_date')} />
                <FieldError msg={errors.closed_deal_date?.message} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <FieldLabel required aiField={aiFields.has('site_location')}>Site / location</FieldLabel>
                <input className="form-input" placeholder="e.g. Istanbul, Turkey" {...register('site_location')} />
                <FieldError msg={errors.site_location?.message} />
              </div>
            </div>
          </div>
        </div>




        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Section 2</div>
              <div className="form-section-title">Categories &amp; estimated value</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 8 }}>
              <FieldLabel required>Project categories</FieldLabel>
              <div className="form-hint" style={{ marginBottom: 12 }}>Pick the types and enter each one&apos;s estimated value</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...DEFAULT_CATEGORIES, ...extraCats].map(cat => {
                const selected = selectedCats.includes(cat);
                const valEmpty = selected && !(parseFloat(catValues[cat] ?? '') > 0);
                return (
                  <div key={cat} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${valEmpty ? '#fca5a5' : selected ? 'var(--brand-teal)' : 'var(--border-subtle)'}`,
                    background: selected ? '#f0fdfa' : '#fff',
                  }}>
                    <div onClick={() => toggleCat(cat)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${selected ? 'var(--brand-teal)' : 'var(--border-default)'}`, background: selected ? 'var(--brand-teal)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {selected && <Check size={10} strokeWidth={3} color="white" />}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{cat}</span>
                    </div>
                    {selected && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>{watch('currency') ?? 'USD'}</span>
                        <input
                          className="form-input num" type="text" inputMode="decimal" placeholder="Estimated value *"
                          value={formatThousands(catValues[cat] ?? '')}
                          onChange={e => setCatValues(v => ({ ...v, [cat]: sanitizeAmount(e.target.value) }))}
                          style={{ width: 170, fontSize: 13 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {SHOW_CUSTOM_CATEGORY && (showCustomInput ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Category name" value={customCatInput}
                    onChange={e => setCustomCatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCat(); } }} autoFocus />
                  <button type="button" className="btn btn-primary btn-sm" onClick={addCustomCat}>Add</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCustomInput(false)}>✕</button>
                </div>
              ) : (
                <div className="cat-card cat-card-add" onClick={() => setShowCustomInput(true)}>
                  <Plus size={14} /> Add custom
                </div>
              ))}
            </div>

            {errors.categories && <div className="form-error" style={{ marginTop: 8 }}>{errors.categories.message}</div>}
            {selectedCats.some(c => !(parseFloat(catValues[c] ?? '') > 0)) && selectedCats.length > 0 && (
              <div className="form-error" style={{ marginTop: 8 }}>Enter an estimated value for every selected type.</div>
            )}


            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="form-group" style={{ marginBottom: 0, width: 200 }}>
                <FieldLabel aiField={aiFields.has('currency')}>Currency</FieldLabel>
                <select className="form-input form-select" {...register('currency')}>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="TRY">TRY — Turkish Lira</option>
                </select>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase' }}>Total deal value</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {watch('currency') ?? 'USD'} {selectedCats.reduce((a, c) => a + (parseFloat(catValues[c] ?? '') || 0), 0).toLocaleString('en-US')}
                </div>
              </div>
            </div>
            <input type="hidden" {...register('deal_value', { valueAsNumber: true })} />
          </div>
        </div>


        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Section 3</div>
              <div className="form-section-title">Timeline</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <FieldLabel required>Estimated delivery date</FieldLabel>
              <input className="form-input" type="date" {...register('est_delivery_date')} />
              <FieldError msg={errors.est_delivery_date?.message} />
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Section 4</div>
              <div className="form-section-title">Dropbox folder location</div>
            </div>
          </div>
          <div className="card-body">
            {isEdit ? (
              <div>
                <div className="form-hint" style={{ marginBottom: 6 }}>The Dropbox folder is not changed when editing.</div>
                <div style={{ padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {editProject!.dropbox_root_path || '— no Dropbox folder linked —'}
                </div>
              </div>
            ) : (
            <>

            <div className="form-group">
              <FieldLabel>Client name (optional)</FieldLabel>
              <input
                className="form-input"
                placeholder="e.g. SPEEDY — leave empty for an Individual project"
                {...register('dropbox_client_name')}
              />
              <div className="form-hint">
                Filled → filed under <b>Clients / {watch('dropbox_client_name')?.trim() || '…'}</b>. Empty → <b>Individuals</b>.
              </div>
            </div>


            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 4 }}>
              {[
                { label: 'Section (from company)', val: watch('dropbox_section') || '— pick a company above' },
                { label: 'Region',                 val: watch('dropbox_region')  || '— pick a region above' },
                { label: 'Status',                 val: 'Under Working' },
                { label: 'Client type',            val: watch('dropbox_client_type') || 'Individuals' },
              ].map(f => (
                <div key={f.label} style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase' }}>{f.label}</div>
                  <div style={{ fontSize: 13, marginTop: 1 }}>{f.val}</div>
                </div>
              ))}
            </div>
            {errors.dropbox_section && <div className="form-error" style={{ marginTop: 8 }}>Pick a Company in Section 1 — it sets the Dropbox section.</div>}


            {watch('dropbox_section') && watch('dropbox_region') && (
              <div style={{ marginTop: 14 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Dropbox path preview</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  /D-Projects/T LINES/{watch('dropbox_section')}/{watch('dropbox_region')}/Under Working/
                  {watch('dropbox_client_type') === 'Clients' ? 'Clients' : 'Individiuals'}
                  {watch('dropbox_client_type') === 'Clients' && watch('dropbox_client_name') ? `/${watch('dropbox_client_name')}` : ''}
                  /{watchedCode || '{number}'} - {watch('site_location') || '{location}'}
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>


        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Section 5</div>
              <div className="form-section-title">Other integrations</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <FieldLabel>ClickUp task ID</FieldLabel>
              <input className="form-input" placeholder="Paste ClickUp task ID" {...register('clickup_task_id')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <FieldLabel>QuickBooks reference</FieldLabel>
              <input className="form-input" placeholder="QuickBooks reference" {...register('quickbooks_ref')} />
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Section 6</div>
              <div className="form-section-title">Initial team</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <FieldLabel required>Trust-Lines PM</FieldLabel>
              <select className="form-input form-select" {...register('trustlines_pm_id')}>
                <option value="">Select Trust-Lines PM...</option>
                {trustlinesPmProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
              {trustlinesPmProfiles.length === 0 && (
                <div className="form-hint">
                  No Trust-Lines PMs found.{' '}
                  <a href="/team" style={{ color: 'var(--brand-teal)' }}>Invite one from Team →</a>
                </div>
              )}
              <FieldError msg={errors.trustlines_pm_id?.message} />
            </div>

          </div>
        </div>

      </div>


      {dropboxConflict && pendingValues && (
        <div style={{
          margin: '16px 0',
          padding: '16px 20px',
          background: 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
          border: '1.5px solid var(--status-warning)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Project number already exists in Dropbox
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                <strong>{pendingValues.project_code.trim()}</strong> was found as{' '}
                <code style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>
                  {dropboxConflict.existingName}
                </code>
                {' '}in the selected location.
                <br />
                Do you want to link the system to this existing Dropbox folder, or change the project code?
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
              onClick={() => proceedWithCreate(pendingValues, dropboxConflict.existingPath)}
            >
              {isSubmitting ? 'Linking...' : `Import "${dropboxConflict.existingName}"`}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={isSubmitting}
              onClick={() => { setDropboxConflict(null); setPendingValues(null); }}
            >
              Change project code
            </button>
          </div>
        </div>
      )}


      <div className="sticky-form-footer">
        <a href={isEdit ? `/projects/${editProject!.id}` : '/projects'} className="btn btn-ghost">Cancel</a>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isEdit && (
            <button type="button" className="btn btn-secondary" disabled={isBusy}>
              Save draft
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isBusy || !!dropboxConflict}
          >
            {isEdit
              ? (isSubmitting ? 'Saving...' : 'Save changes')
              : (isCheckingDropbox ? 'Checking Dropbox...' : isSubmitting ? 'Creating...' : 'Create project')}
          </button>
        </div>
      </div>


      {isBusy && (
        <div style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(0,0,0,.45)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            16,
          zIndex:         9999,
        }}>
          <div style={{
            background:   'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding:      '32px 40px',
            display:      'flex',
            flexDirection:'column',
            alignItems:   'center',
            gap:          14,
            boxShadow:    '0 8px 40px rgba(0,0,0,.3)',
            minWidth:     260,
          }}>
            <span className="dbx-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg-default)' }}>
              {isEdit ? 'Saving changes…' : isCheckingDropbox ? 'Checking Dropbox…' : 'Creating project…'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', textAlign: 'center' }}>
              {isEdit
                ? 'Updating the project'
                : isCheckingDropbox
                  ? 'Scanning for existing project folders'
                  : 'Setting up Dropbox folders and saving to database'}
            </div>
          </div>
        </div>
      )}
    </form>
    </>
  );
}
