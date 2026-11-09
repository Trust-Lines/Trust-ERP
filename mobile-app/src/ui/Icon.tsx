import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { ICONS, type IconName } from './icons';

export type { IconName };

/** Mockup icon (`{{name}}`, `{{name-s}}` = 16, `{{name-l}}` = 26, `{{name-xl}}` = 34). */
export const Icon = memo(function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2 }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const xml = `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
});
