
const DIR = '/TLINES LOGOS PNG';
export const DEFAULT_LOGO = '/logo.png';
export const MAIN_CREATIVITY_LOGO = encodeURI(`${DIR}/main creativity.png`);

const REGION_LOGO_FILES: Record<string, string> = {
  CVW: 'CVW.png',
  NE:  'NE.png',
  NW:  'NW.png',
  SE:  'SE.png',
};

export function regionLogoByCode(code?: string | null): string {
  const file = REGION_LOGO_FILES[(code ?? '').toUpperCase().trim()];
  return file ? encodeURI(`${DIR}/${file}`) : DEFAULT_LOGO;
}

/**
 * The same logo for the app shell (sidebar / top bar). The source PNGs are 4500x4500 with the
 * mark small in the middle, so shrunk to 54px tall it looked tiny; `trimmed/` holds copies cut to
 * the mark itself (216px tall, a few KB). The dashboard keeps the originals — BranchBoard crops
 * them with its own measured insets.
 */
export function shellLogo(src: string): string {
  const prefix = encodeURI(`${DIR}/`);
  return src.startsWith(prefix) ? `${prefix}trimmed/${src.slice(prefix.length)}` : src;
}
