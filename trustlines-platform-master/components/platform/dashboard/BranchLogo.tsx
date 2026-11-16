/* eslint-disable @next/next/no-img-element */

// Figma branch logos (818:37269 TLines mark + wordmark, 818:37281 / 818:37216 / 818:37239 /
// West labels): the TLines mark over the region name, drawn at the Figma size (116 × 67.3) and
// scaled as a whole so every place — board column header, Columns menu chip, workspace region
// tabs — shows the same logo. White artwork; meant for the coloured branch backgrounds.
const W = 116, H = 67.3;

const LABEL: Record<string, { src: string; w: number; h: number; name: string }> = {
  NE:  { src: '/figma/dashboard/ne-label.svg',   w: 116.507, h: 10.5756, name: 'North East' },
  SE:  { src: '/figma/dashboard/se-label.svg',   w: 115.726, h: 10.6077, name: 'South East' },
  NW:  { src: '/figma/dashboard/nw-label.svg',   w: 120.652, h: 10.5988, name: 'Nationwide' },
  CVW: { src: '/figma/dashboard/west-label.svg', w: 47.1942, h: 10.602,  name: 'West' },
};
// West's own copies of the mark + wordmark (818:34126); the others share North East's.
const MARK: Record<string, { mark: string; tlines: string }> = {
  CVW: { mark: '/figma/dashboard/west-mark.svg', tlines: '/figma/dashboard/west-tlines.svg' },
};
const DEFAULT_MARK = { mark: '/figma/dashboard/ne-mark.svg', tlines: '/figma/dashboard/ne-tlines.svg' };

/** `code`: NE | SE | NW | CVW (also accepts W). */
export function BranchLogo({ code, height = H }: { code: string; height?: number }) {
  const key = code === 'W' ? 'CVW' : code;
  const label = LABEL[key];
  const art = MARK[key] ?? DEFAULT_MARK;
  const s = height / H;
  return (
    <span className="relative block shrink-0" style={{ width: W * s, height: H * s }} role="img" aria-label={`T-Lines ${label?.name ?? code}`}>
      <span className="absolute left-0 top-0 flex w-[116px] origin-top-left flex-col items-center gap-3" style={{ transform: `scale(${s})` }}>
        <span className="relative block h-[45.3px] w-[94.2px]">
          <img src={art.mark} alt="" width={93.9656} height={27.2137} className="absolute left-0 top-0 block max-w-none" />
          <img src={art.tlines} alt="" width={94.065} height={21.8596} className="absolute left-[0.11px] top-[23.42px] block max-w-none" />
        </span>
        {label && <img src={label.src} alt="" width={label.w} height={label.h} className="block max-w-none" />}
      </span>
    </span>
  );
}
