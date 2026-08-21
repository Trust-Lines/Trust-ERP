import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSISTANT_TOOLS, runAssistantTool, type AiCtx } from '@/lib/ai/assistantTools';

const MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 8;

interface ChatMsg { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-'))
    return NextResponse.json({ error: 'Trust Lines AI kapalı: geçerli bir ANTHROPIC_API_KEY .env.local dosyasına eklenmeli (şu an placeholder).' }, { status: 503 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, pm_client_id, full_name').eq('id', user.id).single();
  const resolvedRole = (profile as { role?: string } | null)?.role ?? null;
  if (!resolvedRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const ctx: AiCtx = {
    role: resolvedRole,
    pmClientId: (profile as { pm_client_id?: string } | null)?.pm_client_id ?? null,
  };

  const body = await req.json() as { messages?: ChatMsg[]; lang?: string };
  const incoming = (body.messages ?? []).filter(m => m.content?.trim()).slice(-20);
  if (incoming.length === 0) return NextResponse.json({ error: 'No message.' }, { status: 400 });

  const lang = body.lang === 'en' ? 'en' : body.lang === 'tr' ? 'tr' : null;
  const langLine = lang === 'en'
    ? 'CRITICAL LANGUAGE RULE: Write your ENTIRE reply in English ONLY. Never use Turkish, not even in parentheses — even when the question or the data labels are in Turkish, translate everything to English.'
    : lang === 'tr'
    ? 'CRITICAL LANGUAGE RULE: Yanıtının TAMAMINI yalnızca Türkçe yaz; soru veya veri İngilizce olsa bile Türkçe cevap ver.'
    : "Reply in the user's language (Turkish or English) matching their last message.";

  const today = new Date().toISOString().slice(0, 10);
  const system =
    `You are "Trust Lines AI", the in-app assistant for the Trust-Lines production & document-management platform. ` +
    `You answer questions about projects, the production board (PFs/orders), clients & regions, services & margins, the team, and vendors. ` +
    `ALWAYS use the provided tools to fetch live data — never guess or invent figures, names, statuses, or dates. ` +
    `If a tool returns no data, say so plainly. Be concise and practical. ` +
    `FORMATTING (rendered in a narrow chat panel): NEVER use markdown tables or pipe characters. ` +
    `For ONE record, write a short vertical list, one fact per line as "**Label:** value". ` +
    `For MULTIPLE items, use bullet lines like "• **Name / code** — key facts". ` +
    `Bold labels and names with **…**. Omit empty/null fields. Keep answers short and scannable; end with a brief helpful follow-up only when natural. ` +
    `Money: respect the currency on each record. Today is ${today}. ` +
    `The person asking has role "${ctx.role}"${profile && (profile as {full_name?:string}).full_name ? ` (${(profile as {full_name?:string}).full_name})` : ''}; ` +
    `their data access is already scoped by the tools — do not expose anything the tools do not return. ` +
    langLine;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = incoming.map(m => ({ role: m.role, content: m.content }));

  const anthropic = new Anthropic();

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: ASSISTANT_TOOLS as any,
        messages,
      });

      if (res.stop_reason === 'tool_use') {
        const toolUses = res.content.filter(b => b.type === 'tool_use');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any[] = [];
        for (const tu of toolUses) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const t = tu as any;
          const out = await runAssistantTool(t.name, t.input, ctx);
          results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(out).slice(0, 12000) });
        }
        messages.push({ role: 'assistant', content: res.content });
        messages.push({ role: 'user', content: results });
        continue;
      }

      const text = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim();
      return NextResponse.json({ reply: text || '…' });
    }
    return NextResponse.json({ reply: 'Sorry — that needed too many steps. Try narrowing the question.' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI request failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
