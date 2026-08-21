
const TR_MAP: Record<string, string> = {
  'Ş': 'S', 'ş': 'S', 'Ç': 'C', 'ç': 'C', 'Ğ': 'G', 'ğ': 'G',
  'Ü': 'U', 'ü': 'U', 'Ö': 'O', 'ö': 'O', 'İ': 'I', 'ı': 'I',
};

function foldAscii(s: string): string {
  return s.replace(/[ŞşÇçĞğÜüÖöİı]/g, ch => TR_MAP[ch] ?? ch);
}

export function suggestVendorCode(name: string): string {
  const cleaned = foldAscii(name).toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').trim();
  if (!cleaned) return 'VND';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words.map(w => w[0]).join('').slice(0, 5);
    return initials.length >= 2 ? initials : (words[0].slice(0, 3));
  }
  return words[0].slice(0, 3).padEnd(2, 'X');
}
