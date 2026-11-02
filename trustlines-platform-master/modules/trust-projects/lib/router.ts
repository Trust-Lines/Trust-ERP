// T-ERP ADAPTATION: the two react-router-dom hooks this page used, on top of Next.js navigation,
// with the same signatures — so OperationalBoard and ProjectMenu only change their import line.
'use client';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';

/** Trust System pages that don't exist in T-ERP yet open there, in a new tab. */
export const TRUST_SYSTEM_URL = 'https://trust-excel.vercel.app';

type ParamsInit = URLSearchParams | Record<string, string> | string;
type SetParams = (next: ParamsInit | ((prev: URLSearchParams) => ParamsInit), opts?: { replace?: boolean }) => void;

export function useSearchParams(): [URLSearchParams, SetParams] {
  const params = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = useMemo(() => new URLSearchParams(params?.toString() ?? ''), [params]);
  const set = useCallback<SetParams>((next, opts) => {
    const value = typeof next === 'function' ? next(new URLSearchParams(window.location.search)) : next;
    const qs = new URLSearchParams(value as ParamsInit).toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (opts?.replace) router.replace(href, { scroll: false }); else router.push(href, { scroll: false });
  }, [router, pathname]);
  return [current, set];
}

export function useNavigate(): (to: string) => void {
  return useCallback((to: string) => {
    window.open(`${TRUST_SYSTEM_URL}${to.startsWith('/') ? to : `/${to}`}`, '_blank', 'noopener,noreferrer');
  }, []);
}
