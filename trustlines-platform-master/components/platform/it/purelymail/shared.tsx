'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MUTED } from '../itCardParts';

// Shared pieces of the IT → Mails → Purelymail screens: calling our Purelymail routes, error text,
// and the password field (show / copy / generate). Passwords never leave this browser except to
// our route, which passes them straight to Purelymail.

export const MIN_PASSWORD = 12;
export const PANEL_TABLE = 'overflow-x-auto rounded-[8px] border border-ui-divider';
export const TH = 'h-10 whitespace-nowrap px-4 text-left text-[12px] font-semibold text-ui-body';
export const TD = 'h-11 px-4 text-[13px] text-ui-body';

export const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Purelymail refused the API key. Check PURELYMAIL_API_KEY on the server.',
  unavailable: 'Purelymail could not be reached or did not answer in time. Try again.',
  not_configured: 'Purelymail isn’t connected yet (PURELYMAIL_API_KEY is missing on the server).',
};

/** Error text for a failed call to our Purelymail routes. */
export async function failureText(res: Response): Promise<string> {
  const b = await res.json().catch(() => null) as { code?: string; providerCode?: string; error?: string } | null;
  if (res.status === 401 || res.status === 403) return 'You don’t have permission to do this.';
  if (b?.error) return b.error;
  if (b?.code === 'rejected') return `Purelymail refused it${b.providerCode ? ` (${b.providerCode})` : ''}.`;
  return ERROR_TEXT[b?.code ?? ''] ?? ERROR_TEXT.unavailable;
}

/** Run one allow-listed Purelymail operation (/api/it/mails/purelymail/op). Throws Error(message). */
export async function pmOp<T = unknown>(op: string, params: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/it/mails/purelymail/op', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, params }), cache: 'no-store',
    });
  } catch { throw new Error(ERROR_TEXT.unavailable); }
  if (!res.ok) throw new Error(await failureText(res));
  return ((await res.json()) as { result: T }).result;
}

/** Run a change, toast the outcome; resolves true when it worked. */
export async function runChange(f: () => Promise<unknown>, ok: string): Promise<boolean> {
  try { await f(); toast.success(ok); return true; } catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong'); return false; }
}

/** 16 random characters from an unambiguous set (no 0/O, 1/l/I), crypto-strong. */
export function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*-_';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export async function copyText(value: string, what = 'Copied') {
  try { await navigator.clipboard.writeText(value); toast.success(what); } catch { toast.error('Could not copy'); }
}

export function PasswordInput({ id, value, onChange, readOnly = false, generate = true }: {
  id: string; value: string; onChange?: (v: string) => void; readOnly?: boolean; generate?: boolean;
}) {
  const [shown, setShown] = useState(readOnly);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input id={id} type={shown ? 'text' : 'password'} autoComplete="new-password" value={value} readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)} className="h-10 flex-1 font-mono text-[14px]" />
        <Button type="button" variant="ghost" size="icon-md" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(s => !s)}>
          {shown ? <EyeOff /> : <Eye />}
        </Button>
        <Button type="button" variant="ghost" size="icon-md" aria-label="Copy password" disabled={!value} onClick={() => copyText(value, 'Password copied')}><Copy /></Button>
      </div>
      {!readOnly && (
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[12px]', value && value.length < MIN_PASSWORD ? 'text-error-normal' : MUTED)}>At least {MIN_PASSWORD} characters.</span>
          {generate && (
            <button type="button" onClick={() => { onChange?.(generatePassword()); setShown(true); }}
              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-ui-link">
              <Wand2 size={14} aria-hidden /> Generate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A yes / no setting row with a switch. */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ui-divider py-3 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ui-heading">{label}</span>
        {hint && <span className={cn('text-[12px]', MUTED)}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
