





import type { ServiceLine } from '@/lib/demo/mockDashboardData';

export interface MascotConfig {
  label: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  body: string;
  belly: string;

  glbPath: string | null;
}










const FOX = '/mascots/psf-fox.glb';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BEAVER = '/mascots/store-maker.glb';

export const MASCOT_CONFIG: Record<ServiceLine, MascotConfig> = {
  STORE_MAKER: {
    label:      'Store Maker',
    tagline:    'Building Better Stores Every Day',
    accent:     '#5FB25F',
    accentSoft: 'rgba(95, 178, 95, 0.15)',
    body:       '#7a4a2b',
    belly:      '#c98a56',
    glbPath:    FOX,
  },
  DESIGN_BUILD: {
    label:      'Design Build',
    tagline:    'Designed to Build, Built to Last',
    accent:     '#6296C6',
    accentSoft: 'rgba(98, 150, 198, 0.15)',
    body:       '#2f6d78',
    belly:      '#8fd0d9',
    glbPath:    FOX,
  },
  PREMIUM_STORE_FITOUT: {
    label:      'Premium Store Fitout',
    tagline:    'Premium Spaces, Flawless Finish',
    accent:     '#BE8AB8',
    accentSoft: 'rgba(190, 138, 184, 0.16)',
    body:       '#6b4f8a',
    belly:      '#c6a6e0',
    glbPath:    FOX,
  },
};
