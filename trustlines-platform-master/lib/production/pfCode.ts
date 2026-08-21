
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
