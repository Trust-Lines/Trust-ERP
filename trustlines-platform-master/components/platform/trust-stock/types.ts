// Trust Stock (Figma "Trust Stock", node 598:22796): stock batches (e.g. "TR-04") and the PF lines
// ordered into them, with the accounting side (payments, remaining, not ordered, invoice).
// Frontend only for now — there is no Trust Stock table or endpoint yet.

export type StockPfSign = 'signed' | 'pending' | 'not_signed';
export type StockSendStatus = 'sent' | 'not_sent';

export interface TrustStockItem {
  id: string;
  /** "Millwork", "Ceiling", … */
  type: string;
  pfCode: string;
  vendor: string;
  orderNo: string;
  pfSign: StockPfSign;
  status: StockSendStatus;
  /** YYYY-MM-DD dates. */
  std: string | null;
  rtr: string | null;
  rto: string | null;
  pfUsd: number;
  pfTl: number;
  invUsd: number;
  invTl: number;
  /** Payment rule, percent. */
  paymentRule: number | null;
  // ── Accounting ──
  paid1Usd: number;
  paid1UsdDate: string | null;
  paid2Usd: number;
  paid2UsdDate: string | null;
  paid1Tl: number;
  paid1TlDate: string | null;
  paid2Tl: number;
  paid2TlDate: string | null;
  notOrderedUsd: number;
  notOrderedTl: number;
}

export interface TrustStock {
  id: string;
  /** "TR-04". */
  code: string;
  items: TrustStockItem[];
}

// ── Stock Overview (Figma node 601:27426) ──────────────────────────────────────────────────
/** One item received under a stock line (an order to a vendor), tracked by quantity. */
export interface StockPart {
  id: string;
  itemCode: string;
  description: string;
  /** Free text, e.g. 25.5". */
  depth: string;
  width: string;
  height: string;
  ordered: number;
  /** Counted on arrival; null = not verified yet. */
  received: number | null;
  /** Quantity we want to keep on hand. */
  target: number;
  taken: number;
  returned: number;
  reserved: number;
  /** Reorder when available falls to this percent of target. */
  reorderAt: number;
  /** Projects using the item. */
  usedIn: string[];
}

export type PartStatus = 'healthy' | 'watch' | 'reorder' | 'out' | 'pending';
