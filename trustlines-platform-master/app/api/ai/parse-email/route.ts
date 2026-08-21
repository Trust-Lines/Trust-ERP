import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-'))
    return NextResponse.json({ fields: {} });

  const { emailText } = await req.json();
  if (!emailText?.trim()) return NextResponse.json({ fields: {} });

  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    thinking: { type: 'disabled' },
    max_tokens: 500,
    system: `You are a data extraction assistant. Extract project information from the email text.
Return ONLY a JSON object with these exact keys (omit any you cannot find):
{ "project_name", "project_code", "closed_deal_date" (YYYY-MM-DD), "site_location", "deal_value" (number), "currency" (USD|EUR|TRY), "client_name" }
Return nothing else — no markdown, no explanation, just the JSON object.`,
    messages: [{ role: 'user', content: emailText }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    const fields = JSON.parse(text.trim());
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ fields: {} });
  }
}
