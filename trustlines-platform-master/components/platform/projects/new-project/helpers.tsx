import { REGIONS } from '@/lib/regions';

export interface ProfileRow { id: string; full_name: string }
export interface PmProfileRow extends ProfileRow { pm_client_id?: string | null; is_pm_supervisor?: boolean }
export interface ClientRow { id: string; name: string; code: string | null }
export interface CompanyRow { id: string; name: string; code: string | null; client_id: string | null }

export const DEFAULT_CATEGORIES = ['Millwork', 'Shelving', 'Image', 'Ceiling', 'Furniture', 'Decoration'];
export const SHOW_CUSTOM_CATEGORY = true;

export const WIZARD_STEPS = [
  { id: 1, title: 'Project info', subtitle: 'Region, company, location' },
  { id: 2, title: 'Categories & value', subtitle: 'Categories, currency, total' },
  { id: 3, title: 'Timeline', subtitle: 'Delivery date' },
  { id: 4, title: 'Dropbox folder', subtitle: 'Folder rules & details' },
  { id: 5, title: 'Integrations', subtitle: 'ClickUp, QuickBooks' },
  { id: 6, title: 'Initial team', subtitle: 'Assign project team' },
];

export function sectionFromService(name?: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('store maker')) return '1-Store Maker';
  if (n.includes('premium')) return '2-Premium Store Fitout';
  if (n.includes('design')) return '3-Design & Build';
  if (n.includes('shop')) return '4-T Shop';
  return '';
}

export function serviceLineFromCompanyName(name?: string | null): string | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('store maker')) return 'store_maker';
  if (n.includes('premium')) return 'premium_store_fitout';
  if (n.includes('design')) return 'design_build';
  return null;
}

export function regionCodeForClient(client?: { code: string | null; name: string | null } | null): string {
  if (!client) return '';
  const code = (client.code ?? '').trim().toUpperCase();
  const byCode = REGIONS.find(r => r.codeShort.toUpperCase() === code || r.dropboxShort.toUpperCase() === code);
  if (byCode) return byCode.code;
  const name = (client.name ?? '').toUpperCase();
  return REGIONS.find(r => name.includes(r.dropboxShort.toUpperCase()))?.code ?? '';
}

export function formatThousands(raw: string): string {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withSep}.${decPart}` : withSep;
}

export function sanitizeAmount(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

export function FieldLabel({
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

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="form-error">{msg}</div>;
}
