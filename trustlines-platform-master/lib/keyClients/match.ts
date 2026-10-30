// Which key client (if any) an Opportunity belongs to — pure, unit-tested (tests/keyClients.test.ts).
//
// A client matches when the Opportunity's brand, or its Prospect's name, STARTS WITH the client's
// name or one of its aliases, word for word: "HISPEED- Honey Bear" → HISPEED, "Teddy's" → Teddy,
// but "Tabo's piggly wiggly" is not TA. Manual links (key_client_links) always win over the name.

export interface KeyClientDef { id: string; name: string; aliases: string[] }
export interface KeyClientLink {
  key_client_id: string; opportunity_id: string | null; potential_id?: string | null; prospect_id: string | null; mode: 'include' | 'exclude';
}

/** "Teddy's" → ["teddy"], "PARK & GO" → ["park", "and", "go"], "HISPEED- Honey Bear" → ["hispeed", "honey", "bear"]. */
export function nameTokens(s: string | null | undefined): string[] {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    // "Teddys"/"Teddy", "Provisions"/"Provision": a plural/possessive s doesn't make another client.
    .map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

function startsWithTokens(text: string[], prefix: string[]): boolean {
  if (!prefix.length || prefix.length > text.length) return false;
  return prefix.every((t, i) => text[i] === t);
}

export interface Matcher {
  /** The key client for these names (brand, prospect name…), longest name first; null if none. */
  byName: (...names: (string | null | undefined)[]) => KeyClientDef | null;
  /** Manual links + name match for one Opportunity or Potential. */
  forOpportunity: (opp: { id: string; prospect_id: string; brand?: string | null }, prospectNames: (string | null | undefined)[]) => KeyClientDef | null;
  /** An explicit 'include' on this Opportunity/Potential itself (overrides the WAITING rule). */
  includedItem: (id: string) => boolean;
}

export function buildMatcher(clients: KeyClientDef[], links: KeyClientLink[] = []): Matcher {
  // Longest first, so "TA Junction" style aliases beat a shorter client that is also a prefix.
  const patterns = clients
    .flatMap(c => [c.name, ...c.aliases].map(n => ({ client: c, tokens: nameTokens(n) })))
    .filter(p => p.tokens.length)
    .sort((a, b) => b.tokens.length - a.tokens.length);
  const byId = new Map(clients.map(c => [c.id, c]));

  const byName = (...names: (string | null | undefined)[]) => {
    for (const n of names) {
      const t = nameTokens(n);
      if (!t.length) continue;
      const hit = patterns.find(p => startsWithTokens(t, p.tokens));
      if (hit) return hit.client;
    }
    return null;
  };

  const forOpportunity: Matcher['forOpportunity'] = (opp, prospectNames) => {
    const own = links.filter(l => l.opportunity_id === opp.id || l.potential_id === opp.id);
    const ofProspect = links.filter(l => l.prospect_id === opp.prospect_id);
    // 1. An explicit decision on this Opportunity.
    const oppInclude = own.find(l => l.mode === 'include');
    if (oppInclude) return byId.get(oppInclude.key_client_id) ?? null;
    if (own.some(l => l.mode === 'exclude')) return null;
    // 2. An explicit decision on its Prospect.
    const prosInclude = ofProspect.find(l => l.mode === 'include');
    if (prosInclude) return byId.get(prosInclude.key_client_id) ?? null;
    const excluded = new Set(ofProspect.filter(l => l.mode === 'exclude').map(l => l.key_client_id));
    // 3. The name.
    const hit = byName(opp.brand, ...prospectNames);
    return hit && !excluded.has(hit.id) ? hit : null;
  };

  const includedItem = (id: string) => links.some(l => l.mode === 'include' && (l.opportunity_id === id || l.potential_id === id));
  return { byName, forOpportunity, includedItem };
}

/** "STSE507" / "442-NW" / "#507" → "507" (the number the TLines sheet shows). */
export function projectNumber(code: string | null | undefined): string | null {
  const m = String(code ?? '').match(/\d{2,}/);
  return m ? m[0] : null;
}

/** Aliases from a list or comma/new-line text: trimmed, unique, max 30. */
export function cleanAliases(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(String) : String(v ?? '').split(/[,\n]/);
  return [...new Set(raw.map(a => a.trim()).filter(Boolean).map(a => a.slice(0, 80)))].slice(0, 30);
}
