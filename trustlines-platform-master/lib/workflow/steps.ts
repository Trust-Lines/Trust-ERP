import type { ProjectCategory } from '@/types/database';

export type CategoryGroup = 'millwork' | 'shelving' | 'ceiling' | 'image';
export type StepPhase     = 'phase1' | 'phase2' | 'phase3' | 'delivery';
export type StepStatus    = 'pending' | 'done' | 'approved' | 'rejected';

export interface StepDef {
  key: string;
  label: string;
  hasDocument: boolean;
  requiresApproval: boolean;
  requiresVersionSelect: boolean;
  isOptional: boolean;
  docType?: string;
}

export interface StepRecord {
  id: string;
  project_id: string;
  phase: string;
  cat_group: string | null;
  step_key: string;
  status: StepStatus;
  document_id: string | null;
  version_approved: number | null;
  completed_by: string | null;
  completed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
}

export const PHASE1_STEPS: StepDef[] = [
  {
    key: 'closed_deal',
    label: 'Closed Deal Date',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
  },
  {
    key: 'plan_layout',
    label: 'Plan Layout',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'plan_layout',
  },
  {
    key: 'design_proposal',
    label: 'Design Proposal',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'proposal',
  },
  {
    key: 'client_approval',
    label: 'Client Approval',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: true,
    isOptional: false,
  },
];

export const PHASE2_STEPS: StepDef[] = [
  {
    key: 'construction_drawings',
    label: 'Construction Drawings',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'construction_drawings',
  },
];

export const CATEGORY_STEPS: StepDef[] = [
  {
    key: 'proposal',
    label: 'Proposal',
    hasDocument: true,
    requiresApproval: true,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'proposal',
  },
  {
    key: 'item_plan',
    label: 'Item Plan',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'item_plan',
  },
  {
    key: 'item_list',
    label: 'Item List',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'item_list',
  },
  {
    key: 'item_price_list',
    label: 'Item Price List',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'price_list',
  },
  {
    key: 'book',
    label: 'Book',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'book',
  },
  {
    key: 'po',
    label: 'Purchase Order (PO)',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'po_bo',
  },
  {
    key: 'pfs',
    label: 'Production Forms',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'pf',
  },
  {
    key: 'production_starting',
    label: 'Production Starting',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
  },
  {
    key: 'qc',
    label: 'Quality Control',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'qc_checklist',
  },
  {
    key: 'payment_to_vendor',
    label: 'Payment to Vendor',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
  },
  {
    key: 'packing',
    label: 'Packing',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'packing_list',
  },
  {
    key: 'sent_to_tlines',
    label: 'Sent to T-Lines',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'shipment_doc',
  },
];

export const DELIVERY_STEPS: StepDef[] = [
  {
    key: 'shipped',
    label: 'Shipped',
    hasDocument: true,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
    docType: 'shipment_doc',
  },
  {
    key: 'received_usa',
    label: 'Received in USA Warehouse',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
  },
  {
    key: 'transfer',
    label: 'Transfer',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: true,
  },
  {
    key: 'deliver_job_site',
    label: 'Deliver to Job Site',
    hasDocument: false,
    requiresApproval: false,
    requiresVersionSelect: false,
    isOptional: false,
  },
];

export const CAT_GROUP_LABELS: Record<CategoryGroup, string> = {
  millwork: 'Millwork',
  shelving: 'Shelving',
  ceiling:  'Ceiling',
  image:    'Image',
};

export const CAT_GROUP_COLORS: Record<CategoryGroup, { color: string; bg: string; border: string }> = {
  millwork: { color: '#1a6b6b', bg: '#e1f0f0', border: '#9ecfcf' },
  shelving: { color: '#155f5f', bg: '#d5eaea', border: '#8bbfbf' },
  ceiling:  { color: '#a84623', bg: '#fbe6dc', border: '#f0b9a0' },
  image:    { color: '#8c3a1d', bg: '#f5ddd3', border: '#e8ab90' },
};

export function getActiveCategoryGroups(
  categories: ProjectCategory[] | string | null | undefined,
): CategoryGroup[] {
  if (!categories) return [];

  let cats: string[];
  if (typeof categories === 'string') {
    cats = (categories as string).replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
  } else {
    cats = categories as string[];
  }

  const lower = cats.map(c => c.toLowerCase());
  const groups: CategoryGroup[] = [];

  if (cats.some(c => ['M1','M2','M3'].includes(c)) || lower.includes('millwork'))
    groups.push('millwork');
  if (cats.some(c => ['S1','S2','S3'].includes(c)) || lower.includes('shelving'))
    groups.push('shelving');
  if (cats.some(c => ['C1','C2','C3'].includes(c)) || lower.includes('ceiling'))
    groups.push('ceiling');
  if (cats.some(c => ['I1','I2','I3'].includes(c)) || lower.includes('image'))
    groups.push('image');

  return groups;
}

export function findStep(
  steps: StepRecord[],
  phase: string,
  stepKey: string,
  catGroup?: string | null,
): StepRecord | undefined {
  return steps.find(
    s => s.phase === phase && s.step_key === stepKey && (s.cat_group ?? null) === (catGroup ?? null),
  );
}

export function findAllDocsForStep(
  documents: { id: string; step_key: string | null; cat_group: string | null; doc_type: string; version: number; dropbox_version?: number | null; status: string }[],
  stepKey: string,
  catGroup?: string | null,
  docType?: string,
): { id: string; version: number; dropbox_version: number | null; status: string }[] {
  const byStep = documents.filter(
    d => d.step_key === stepKey && (d.cat_group ?? null) === (catGroup ?? null),
  );
  const source = byStep.length > 0
    ? byStep
    : docType
      ? documents.filter(d => d.doc_type === docType && (d.cat_group ?? null) === (catGroup ?? null))
      : [];
  return source
    .map(d => ({ ...d, dropbox_version: d.dropbox_version ?? null }))
    .sort((a, b) => (a.dropbox_version ?? a.version) - (b.dropbox_version ?? b.version));
}

export function findDocForStep(
  documents: { id: string; step_key: string | null; cat_group: string | null; doc_type: string; version: number; dropbox_version?: number | null; status: string }[],
  stepKey: string,
  catGroup?: string | null,
  docType?: string,
): { id: string; version: number; dropbox_version: number | null; status: string } | undefined {
  const byStep = documents.find(
    d => d.step_key === stepKey && (d.cat_group ?? null) === (catGroup ?? null),
  );
  if (byStep) return { ...byStep, dropbox_version: byStep.dropbox_version ?? null };

  if (docType) {
    const found = documents
      .filter(d => d.doc_type === docType && (d.cat_group ?? null) === (catGroup ?? null))
      .sort((a, b) => b.version - a.version)[0];
    return found ? { ...found, dropbox_version: found.dropbox_version ?? null } : undefined;
  }
  return undefined;
}
