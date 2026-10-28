'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, SendHorizontal, Paperclip, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Msg { role: 'user' | 'assistant'; content: string }

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>,
  );
}

function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 5 }} />;
        if (/^#{1,3}\s/.test(t))
          return <div key={i} style={{ fontWeight: 700, fontSize: 13.5, marginTop: i ? 3 : 0 }}>{renderInline(t.replace(/^#{1,3}\s/, ''))}</div>;
        if (/^[-•*]\s/.test(t))
          return (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--ui-nav-active)' }}>•</span>
              <span>{renderInline(t.replace(/^[-•*]\s/, ''))}</span>
            </div>
          );
        if (/^\|?\s*:?-{2,}/.test(t)) return null;
        if (t.startsWith('|')) {
          const cells = t.split('|').map(c => c.trim()).filter(Boolean);
          return <div key={i}>{renderInline(cells.join(' — '))}</div>;
        }
        return <div key={i}>{renderInline(t)}</div>;
      })}
    </div>
  );
}

type Lang = 'tr' | 'en';

const I18N: Record<Lang, {
  subtitle: string; empty: string; placeholder: string; thinking: string; suggestions: string[];
}> = {
  tr: {
    subtitle: 'Projeler · üretim · müşteriler · ekip',
    empty: 'Şirketin verileriyle ilgili her şeyi sorabilirsin.',
    placeholder: 'Buraya yaz..',
    thinking: 'düşünüyor…',
    suggestions: [
      'Bana genel bir özet ver',
      'Aktif projeler neler?',
      'Ödeme bekleyen işler hangileri?',
      'Ekipte kimler var ve rolleri ne?',
    ],
  },
  en: {
    subtitle: 'Projects · production · clients · team',
    empty: 'Ask me anything about the company data.',
    placeholder: 'Type here..',
    thinking: 'thinking…',
    suggestions: [
      'Give me an overview',
      'What are the active projects?',
      'What is waiting for payment?',
      'Who is on the team and their roles?',
    ],
  },
};

/** Window event the top-bar "Trust Lines AI" button fires to open (toggle) this panel. */
export const OPEN_AI_EVENT = 'tl:open-ai';
/** Fired by the panel with `detail: boolean` whenever it opens or closes, so the top bar can show its active state. */
export const AI_STATE_EVENT = 'tl:ai-state';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

// Figma "Trust Lines AI panel" (node 334:13694): docked right under the 80px top bar,
// full height, 383px wide — dark header, surface body, composer pinned to the bottom.
export function TrustLinesAI() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(o => !o);
    window.addEventListener(OPEN_AI_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AI_EVENT, onOpen);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(AI_STATE_EVENT, { detail: open }));
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Figma header (336:14306) has no language switch; the panel is English-only.
  const lang: Lang = 'en';
  const t = I18N[lang];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lang }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setMessages(m => [...m, { role: 'assistant', content: data.reply ?? `⚠️ ${data.error ?? (lang === 'en' ? 'Something went wrong.' : 'Bir hata oluştu.')}` }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: lang === 'en' ? '⚠️ Connection error.' : '⚠️ Bağlantı hatası.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <aside
      aria-label="Trust Lines AI"
      className="fixed bottom-0 right-0 top-20 z-40 flex w-[min(383px,100vw)] flex-col overflow-hidden border-l border-ui-divider bg-ui-page-bg shadow-03"
    >
      {/* ── Header ── */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-ui-divider bg-[var(--color-secondary-700)] px-4">
        <Bot size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-white" />
        <div className="flex min-w-0 flex-1 flex-col leading-normal">
          <p className="m-0 text-[14px] font-semibold text-white">Trust Lines AI</p>
          <p className="m-0 truncate text-[11px] text-[var(--color-primary-100)]">{t.subtitle}</p>
        </div>
        <button
          type="button" onClick={() => setOpen(false)} aria-label="Close Trust Lines AI"
          className="grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-[4px] border-0 bg-white p-px text-[var(--color-secondary-700)] transition-opacity hover:opacity-90"
        >
          <X size={24} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {/* ── Conversation ── */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-b border-ui-divider bg-ui-surface p-2">
        {messages.length === 0 ? (
          <div className="m-auto flex w-full max-w-[339px] flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot size={87} strokeWidth={1.25} aria-hidden className="text-ui-text-disabled" />
              <p className="m-0 text-[13px] font-medium leading-[1.4] text-ui-text-disabled">{t.empty}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {t.suggestions.map(s => (
                <button
                  key={s} type="button" onClick={() => send(s)}
                  className="flex h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-[8px] border border-ui-divider bg-ui-input-bg pl-[17px] pr-3 text-left text-[13px] font-medium leading-[1.4] text-ui-text-secondary transition-colors hover:bg-ui-hover-bg hover:text-ui-body"
                >
                  <Sparkles size={15} aria-hidden className="shrink-0" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={cn('max-w-[88%] px-1', m.role === 'user' ? 'self-end' : 'self-start')}>
                <div
                  className={cn(
                    'rounded-[8px] px-3 py-2 text-[13px] leading-[1.5]',
                    m.role === 'user'
                      ? 'rounded-br-[2px] bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950'
                      : cn('rounded-bl-[2px] border border-ui-divider bg-ui-surface-elevated', HEADING),
                  )}
                >
                  {m.role === 'assistant'
                    ? <RichText text={m.content} />
                    : <span className="whitespace-pre-wrap">{m.content}</span>}
                </div>
              </div>
            ))}
            {loading && <p className="m-0 self-start px-2 py-1 text-[13px] text-ui-text-secondary">{t.thinking}</p>}
          </>
        )}
      </div>

      {/* ── Composer ── */}
      <div className="flex h-[143px] shrink-0 items-center gap-2 bg-ui-surface-elevated pl-4 pr-2">
        <textarea
          aria-label={t.placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={t.placeholder}
          disabled={loading}
          className="h-20 min-h-[42px] min-w-0 flex-1 resize-none rounded-[6px] border border-[var(--ui-input-border)] bg-ui-surface-elevated p-3 text-[14px] leading-[1.4] text-ui-heading outline-none placeholder:text-ui-body focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:opacity-60"
        />
        <div className="flex w-[89px] shrink-0 flex-col gap-2">
          {/* The assistant API takes text only, so the attach control from the design stays disabled. */}
          <button
            type="button" disabled title={lang === 'en' ? 'Attachments are not supported yet' : 'Dosya ekleme henüz desteklenmiyor'}
            aria-label={lang === 'en' ? 'Attach file' : 'Dosya ekle'}
            className={cn('flex h-9 w-full items-center justify-center rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:border-ui-heading', HEADING)}
          >
            <Paperclip size={16} aria-hidden />
          </button>
          <button
            type="button" onClick={() => send(input)} disabled={loading || !input.trim()}
            aria-label={lang === 'en' ? 'Send' : 'Gönder'}
            className="flex h-9 w-full cursor-pointer items-center justify-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
          >
            <SendHorizontal size={16} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
