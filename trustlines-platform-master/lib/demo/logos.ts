import type { Region4 } from './execData';

export const REGION_LOGO: Record<Region4, string> = {
  NE: '/TLINES LOGOS PNG/NE.png',
  SE: '/TLINES LOGOS PNG/SE.png',
  NW: '/TLINES LOGOS PNG/NW.png',
  West: '/TLINES LOGOS PNG/CVW.png',
};
export const ALL_REGIONS_LOGO = '/TLINES LOGOS PNG/main creativity.png';

export function headerLogo(region: Region4, allRegions: boolean): string {
  return allRegions ? ALL_REGIONS_LOGO : REGION_LOGO[region];
}
