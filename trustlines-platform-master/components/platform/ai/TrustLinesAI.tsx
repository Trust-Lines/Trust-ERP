'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send } from 'lucide-react';

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
              <span style={{ color: 'var(--brand-teal, #0d9488)' }}>•</span>
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
    placeholder: 'Bir şey sor…',
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
    placeholder: 'Ask something…',
    thinking: 'thinking…',
    suggestions: [
      'Give me an overview',
      'What are the active projects?',
      'What is waiting for payment?',
      'Who is on the team and their roles?',
    ],
  },
};

export function TrustLinesAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>('tr');
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

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Trust Lines AI"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 60,
            width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--brand-teal, #0d9488), #0f766e)',
            color: '#fff', boxShadow: '0 6px 22px rgba(13,148,136,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Sparkles size={24} />
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 60,
            width: 'min(400px, calc(100vw - 32px))', height: 'min(580px, calc(100vh - 100px))',
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-elevated, #fff)', borderRadius: 16,
            border: '1px solid var(--border-subtle, #e5e7eb)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.22)', overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px',
            background: 'linear-gradient(135deg, var(--brand-teal, #0d9488), #0f766e)', color: '#fff',
          }}>
            <Sparkles size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>Trust Lines AI</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{t.subtitle}</div>
            </div>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 7, padding: 2, marginRight: 4 }}>
              {(['tr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 7px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: lang === l ? '#fff' : 'transparent', color: lang === l ? 'var(--brand-teal, #0d9488)' : '#fff',
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.9 }}>
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto 0', textAlign: 'center', color: 'var(--fg-subtle, #6b7280)' }}>
                <Sparkles size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div style={{ fontSize: 13, marginBottom: 14 }}>{t.empty}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {t.suggestions.map(s => (
                    <button key={s} onClick={() => send(s)} style={{
                      fontSize: 12.5, textAlign: 'left', padding: '8px 11px', borderRadius: 9,
                      border: '1px solid var(--border-subtle, #e5e7eb)', background: 'var(--bg-subtle, #f9fafb)',
                      color: 'var(--fg, #111827)', cursor: 'pointer',
                    }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  fontSize: 13, lineHeight: 1.5, padding: '9px 12px', borderRadius: 12,
                  background: m.role === 'user' ? 'var(--brand-teal, #0d9488)' : 'var(--bg-subtle, #f3f4f6)',
                  color: m.role === 'user' ? '#fff' : 'var(--fg, #111827)',
                  borderBottomRightRadius: m.role === 'user' ? 3 : 12,
                  borderBottomLeftRadius: m.role === 'user' ? 12 : 3,
                }}>
                  {m.role === 'assistant'
                    ? <RichText text={m.content} />
                    : <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--fg-subtle, #6b7280)', padding: '4px 6px' }}>
                {t.thinking}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border-subtle, #e5e7eb)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input); }}
              placeholder={t.placeholder}
              disabled={loading}
              style={{
                flex: 1, fontSize: 13, padding: '9px 12px', borderRadius: 10,
                border: '1px solid var(--border-subtle, #e5e7eb)', background: 'var(--bg, #fff)', color: 'var(--fg, #111827)', outline: 'none',
              }}
            />
            <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{
              width: 40, borderRadius: 10, border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              background: 'var(--brand-teal, #0d9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: input.trim() && !loading ? 1 : 0.5,
            }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
