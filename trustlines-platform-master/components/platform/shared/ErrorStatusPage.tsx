import Link from 'next/link';
import { Ghost, House, OctagonMinus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Figma "404" (node 329:11964) and "403" (node 329:10997). The large backdrop numerals are
// used as a CSS mask so their gradient follows the theme tokens instead of the white→#96A3B6
// baked into the file. The digit marks stay plain <img>: the logo swoosh carries a white
// knockout stroke a mask would lose, so dark mode inverts them instead.
const VARIANTS = {
  404: {
    title: 'Page not found',
    icon: Ghost,
    backdrop: { src: '/not-found/404-backdrop.svg', ratio: '1920 / 509.98' },
    // 404's digits and logo swoosh are separate layers; the swoosh sits over the "0".
    layers: [
      { src: '/not-found/404-digits.svg', className: 'relative h-[118.4px] w-[309.25px]' },
      { src: '/not-found/404-swoosh.svg', className: 'absolute left-[78.4px] top-[36.9px] h-[42.11px] w-[137.68px]' },
    ],
  },
  403: {
    title: 'Forbidden',
    icon: OctagonMinus,
    backdrop: { src: '/not-found/403-backdrop.svg', ratio: '1903.41 / 522' },
    layers: [{ src: '/not-found/403-mark.svg', className: 'relative h-[118.4px] w-[303.17px]' }],
  },
} as const;

function maskStyle(src: string): React.CSSProperties {
  const url = `url("${src}")`;
  return { maskImage: url, WebkitMaskImage: url, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' };
}

export function ErrorStatusPage({ code, homeHref = '/' }: { code: keyof typeof VARIANTS; homeHref?: string }) {
  const v = VARIANTS[code];
  const Icon = v.icon;
  return (
    // -m-6 cancels the shell's 24px main padding so the backdrop bleeds to the content edges.
    <div className="relative -m-6 flex min-h-[calc(100vh-80px)] flex-col items-center justify-center overflow-hidden bg-ui-page-bg pb-32 [--status-tint:var(--color-primary-300)] dark:[--status-tint:var(--color-secondary-700)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--status-tint)_20%,transparent),color-mix(in_srgb,var(--status-tint)_62%,transparent))]"
        style={{ ...maskStyle(v.backdrop.src), aspectRatio: v.backdrop.ratio }}
      />

      <div className="relative flex flex-col items-center text-center">
        <Icon size={32} aria-hidden className="text-[var(--color-primary-300)] dark:text-ui-text-secondary" />
        <div role="img" aria-label={String(code)} className="relative mt-[34px]">
          {v.layers.map(l => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.src} src={l.src} alt="" aria-hidden className={cn('block max-w-none dark:invert dark:hue-rotate-180', l.className)} />
          ))}
        </div>
        <h1 className="m-0 mt-5 text-[32px] font-medium uppercase leading-normal tracking-[2.24px] text-[var(--color-secondary-700)] dark:text-ui-heading">
          {v.title}
        </h1>
        <Link
          href={homeHref}
          className="mt-9 inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-[var(--color-secondary-700)] pl-6 pr-[30px] text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90 dark:border-primary-50 dark:bg-primary-50 dark:text-primary-950"
        >
          <House size={16} aria-hidden /> Back to Homepage
        </Link>
      </div>
    </div>
  );
}
