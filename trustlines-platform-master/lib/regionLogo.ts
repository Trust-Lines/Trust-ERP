
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
