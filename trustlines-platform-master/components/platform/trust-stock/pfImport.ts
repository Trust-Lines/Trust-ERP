// Trust Stock "Upload PF PDF": calls to the Trust System through T-ERP's /api/trust proxy (the API
// key stays on the server). The Trust System reads the PDF (rule based) and owns PF codes, vendor
// matching, duplicate checks and the stock group; this side only shows and sends.
//   POST /trust-stock/pdf/preview  multipart file          → values, warnings, layout (saves nothing)
//   POST /trust-stock/pdf/import   multipart file + data   → stock group / PF row / products, PDF kept
//   GET  /trust-stock/catalog                              → earlier products, for item-code hints
//   GET  /vendors                                          → vendor list

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // Vercel request limit is 4.5 MB
export const PF_TYPES = ['MILLWORK', 'SHELVING', 'CEILING', 'IMAGE', 'FURNITURE', 'DECORATION'] as const;
export type PfType = typeof PF_TYPES[number];
export type Currency = 'USD' | 'TL' | 'EUR';

export interface ParsedStockProduct {
  itemCode: string;
  description: string;
  category: string | null;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
}

/** Where a product row sits in the PDF: points, origin bottom-left, page 0-based, y0 < y1. */
export interface PfRowLayout { itemCode: string; page: number; x0: number; x1: number; y0: number; y1: number }

export interface PfPdfPreview {
  stockCode: string | null;
  pfCode: string | null;
  supplierName: string | null;
  vendor: { id: string; code: string; name: string } | null;
  pfDate: string | null;
  type: string | null;
  currency: Currency;
  totalPrice: number | null;
  paymentRule: string | null;
  products: ParsedStockProduct[];
  warnings: string[];
  groupStatus: 'new' | 'exists' | 'in-trash';
  duplicateOf: { itemId: string; groupCode: string } | null;
  layout?: PfRowLayout[];
}

/** Exactly the fields the import accepts — the server rejects anything else. */
export interface PfImportData {
  stockCode: string;
  pfCode: string;
  vendorId: string | null;
  type: PfType | null;
  orderNo: string | null;
  pfDate: string | null;
  currency: Currency;
  totalPrice: number | null;
  paymentRule: string | null;
  products: { itemCode: string; description?: string; category?: string | null; quantity: number; unitPrice?: number | null; totalPrice?: number | null }[];
}

export interface StockCatalogItem { itemCode: string; description: string; dimensions: string | null; category: string | null; unitPrice: number | null; currency: string }
export interface Vendor { id: string; code: string; name: string }

/** What the import returns (the Trust System's stock item); only the fields used here. */
export interface ImportedPf { id?: string; pfCode?: string | null; vendor?: Vendor | null; pfSignStatus?: string | null; paymentRule?: string | null }

export class TrustError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function read<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = (body as { message?: string | string[] }).message;
    throw new TrustError((Array.isArray(m) ? m.join(' · ') : m) || fallback, res.status);
  }
  return body as T;
}

export async function previewPfPdf(file: File, signal?: AbortSignal): Promise<PfPdfPreview> {
  const form = new FormData();
  form.append('file', file);
  return read(await fetch('/api/trust/trust-stock/pdf/preview', { method: 'POST', body: form, signal }), 'Could not read the PDF');
}

export async function importPfPdf(file: File, data: PfImportData): Promise<ImportedPf> {
  const form = new FormData();
  form.append('file', file);
  form.append('data', JSON.stringify(data));
  return read(await fetch('/api/trust/trust-stock/pdf/import', { method: 'POST', body: form }), 'Save failed');
}

export async function getStockCatalog(): Promise<StockCatalogItem[]> {
  const b = await read<StockCatalogItem[] | { data: StockCatalogItem[] }>(await fetch('/api/trust/trust-stock/catalog'), 'Could not load the product catalog');
  return Array.isArray(b) ? b : b.data ?? [];
}

export async function getVendors(): Promise<Vendor[]> {
  const b = await read<Vendor[] | { data: Vendor[] }>(await fetch('/api/trust/vendors'), 'Could not load vendors');
  return Array.isArray(b) ? b : b.data ?? [];
}

/** Only the accepted product fields, numbers as numbers. */
export const cleanProducts = (ps: ParsedStockProduct[]): PfImportData['products'] => ps.map(p => ({
  itemCode: p.itemCode.trim(),
  description: p.description,
  category: p.category ?? null,
  quantity: Number(p.quantity) || 0,
  unitPrice: p.unitPrice ?? null,
  totalPrice: p.totalPrice ?? null,
}));

export const catalogText = (c: StockCatalogItem) => (c.dimensions ? `${c.description} (${c.dimensions})` : c.description);
export const currencySymbol = (c: Currency) => (c === 'TL' ? '₺' : c === 'EUR' ? '€' : '$');
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The PDF overlay box for a layout row on a page drawn at `scale` (CSS px per point). Whole-row
 * width: the table spans the page, l.x0..l.x1 is only the picture cell.
 */
export function rowBox(l: PfRowLayout, pageHeightPt: number, scale: number, pageWidthPx: number) {
  return { top: (pageHeightPt - l.y1) * scale, height: (l.y1 - l.y0) * scale, left: pageWidthPx * 0.03, width: pageWidthPx * 0.94 };
}
