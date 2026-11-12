
export const TYPE_LETTER: Record<string, string> = {
  Millwork: 'M', Shelving: 'S', Ceiling: 'C', Image: 'I', Furniture: 'F', Decoration: 'D',
};

function millworkSuffix(orderType: string | null | undefined): string {
  const o = String(orderType ?? '').toUpperCase().replace(/\s+/g, '');
  if (o.includes('FURNITURE'))                         return 'F01';
  if (o.includes('SELECTIVE') && o.includes('CUSTOM')) return 'M03';
  if (o.includes('STANDARD')  && o.includes('SELECTIVE')) return 'M02';
  if (o.includes('STANDARD')  && o.includes('BASIC'))  return 'M01';
  return 'M01';
}

export function projectNumberFromCode(code: string): string {
  const digits = code.match(/\d+/);
  return digits ? digits[0] : code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export interface PfCodeParams {
  vendorCode:   string;
  projectNo:    string;
  type:         string;
  orderType?:   string | null;
  existingCodes: string[];
}

export function generatePfCode(p: PfCodeParams): string | null {
  const letter = TYPE_LETTER[p.type];
  if (!p.vendorCode || !letter) return null;

  const prefix = `${p.vendorCode}-${p.projectNo}-`;

  if (p.type === 'Millwork') {
    return `${prefix}${millworkSuffix(p.orderType)}`;
  }

  let maxSeq = 0;
  const re = new RegExp(`^${escapeRegex(prefix)}${letter}(\\d+)$`, 'i');
  for (const c of p.existingCodes) {
    const m = c.match(re);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  const seq = String(maxSeq + 1).padStart(2, '0');
  return `${prefix}${letter}${seq}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Production tracker PF codes (Trust System rules) ─────────────────────────────────────────
// Format {VENDOR}-{OWNER}-{LETTER}{NN}: OWNER is the project number ("440"), a Missing & Extra
// case code ("344-EX-1") or "P" + the Direct Order number ("PDO07").
//   • Projects: a code exists only with a vendor AND PF sign status WAITING T TO SIGN, WAITING
//     TLINES TO SIGN, SIGNED or SIGNED WITH EST PRICE. Cases: as soon as there is a vendor.
//   • Vendors with "Millwork PF code by order type" (suppliers.fixed_millwork_codes): a Millwork
//     row's number comes from its order type — STANDARD / BASIC M01, STANDARD / SELECTIVE M02,
//     CUSTOM / SELECTIVE M03 — reserved even when unused and shared by rows with the same type;
//     any other order type takes the lowest free number from M04.
//   • A Millwork row whose order type contains FURNITURE gets F (any vendor).
//   • Otherwise the lowest free number for that vendor + owner + letter (deleted rows hold none).

export const PF_CODE_SIGN_STATUSES = new Set(['WAITING_T_TO_SIGN', 'WAITING_TLINES_TO_SIGN', 'SIGNED', 'SIGNED_WITH_EST_PRICE']);

const lettersOnly = (s: string | null | undefined) => String(s ?? '').toUpperCase().replace(/[^A-Z]/g, '');

/** M01–M03 for the fixed-code vendors' Millwork, from the order type; null for any other order type. */
export function fixedMillworkSlot(orderType: string | null | undefined): 1 | 2 | 3 | null {
  const o = lettersOnly(orderType);
  if (o === 'STANDARDBASIC') return 1;
  if (o === 'STANDARDSELECTIVE') return 2;
  if (o === 'CUSTOMSELECTIVE' || o === 'SELECTIVECUSTOM') return 3;
  return null;
}

export const isFurnitureOrder = (orderType: string | null | undefined) => lettersOnly(orderType).includes('FURNITURE');

/** The project number a PF code carries: the Trust number when the project came from there, else the code after its prefix. */
export function pfOwnerForProject(code: string, trustProjectNo?: string | null): string {
  if (trustProjectNo && String(trustProjectNo).trim()) return String(trustProjectNo).trim().replace(/\s+/g, ' ');
  return code.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^(ST|PS|DS)(NE|SE|NW|W|HQ|TC)?\s+/, '');
}
export const pfOwnerForCase = (kind: string, code: string) => (kind === 'direct_order' ? `P${code.replace(/-/g, '')}` : code);

export interface BoardPfCodeInput {
  vendorCode: string | null;
  fixedMillwork: boolean;
  owner: string;
  type: string;
  /** Custom types: the type's own short code. */
  customTypeCode?: string | null;
  orderType?: string | null;
  /** PF codes of this vendor's other live rows under the same owner. */
  siblingCodes: string[];
}

export function computeBoardPfCode(p: BoardPfCodeInput): string | null {
  if (!p.vendorCode) return null;
  const furniture = p.type === 'Millwork' && isFurnitureOrder(p.orderType);
  const letter = furniture ? 'F' : (TYPE_LETTER[p.type] ?? p.customTypeCode ?? null);
  if (!letter) return null;
  const prefix = `${p.vendorCode}-${p.owner}-`;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (letter === 'M' && p.type === 'Millwork' && p.fixedMillwork) {
    const slot = fixedMillworkSlot(p.orderType);
    if (slot) return `${prefix}M${pad(slot)}`;
  }
  const re = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(letter)}(\\d+)$`, 'i');
  const used = new Set(p.siblingCodes.map(c => c.match(re)).filter(Boolean).map(m => parseInt(m![1], 10)));
  let n = letter === 'M' && p.type === 'Millwork' && p.fixedMillwork ? 4 : 1;
  while (used.has(n)) n++;
  return `${prefix}${letter}${pad(n)}`;
}
