
import type { SystemEvent, SystemEventType } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EmitEventInput {
  type:         SystemEventType;
  entityTable:  string;
  entityId?:    string | null;
  projectId?:   string | null;
  leadId?:      string | null;
  actorId?:     string | null;
  payload?:     Record<string, unknown>;
  dedupeKey?:   string;
}

export type EventHandler = (admin: any, event: SystemEvent) => Promise<void>;

const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  /^pf(_|$)/i,
  /price/i,
  /cost/i,
  /margin/i,
  /invoice/i,
  /expense/i,
  /budget/i,
  /amount/i,
  /deal_value/i,
  /vendor_id/i,
  /vendor_price/i,
  /payment_rule/i,
];

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some(re => re.test(key));
}

export function sanitizeEventPayload(payload: unknown): Record<string, unknown> {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (isForbiddenKey(k)) continue;
        out[k] = clean(v);
      }
      return out;
    }
    return value;
  };

  const cleaned = clean(payload ?? {});
  return (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned))
    ? cleaned as Record<string, unknown>
    : {};
}

export function buildDedupeKey(input: EmitEventInput): string {
  return input.dedupeKey ?? `${input.type}:${input.entityTable}:${input.entityId ?? 'none'}`;
}

const REGISTRY = new Map<SystemEventType, EventHandler[]>();

export function registerHandler(type: SystemEventType, handler: EventHandler): void {
  const list = REGISTRY.get(type) ?? [];
  list.push(handler);
  REGISTRY.set(type, list);
}

export function handlersFor(type: SystemEventType): EventHandler[] {
  return REGISTRY.get(type) ?? [];
}

export function _resetHandlers(): void {
  REGISTRY.clear();
}

export async function handleEvent(admin: any, event: SystemEvent): Promise<void> {
  const handlers = REGISTRY.get(event.event_type as SystemEventType) ?? [];
  for (const handler of handlers) {
    try {
      await handler(admin, event);
    } catch (e) {
      console.error(`[events] handler failed for ${event.event_type}:`, e instanceof Error ? e.message : e);
    }
  }
}

export async function emitEvent(admin: any, input: EmitEventInput): Promise<SystemEvent | null> {
  let event: SystemEvent;

  try {
    const row = {
      event_type:   input.type,
      project_id:   input.projectId ?? null,
      lead_id:      input.leadId ?? null,
      entity_table: input.entityTable,
      entity_id:    input.entityId ?? null,
      actor_id:     input.actorId ?? null,
      payload:      sanitizeEventPayload(input.payload),
      dedupe_key:   buildDedupeKey(input),
    };

    const { data, error } = await admin
      .from('system_events')
      .upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[events] emit failed:', error.message);
      return null;
    }
    if (!data) return null;

    event = data as SystemEvent;
  } catch (e) {
    console.error('[events] emit threw:', e instanceof Error ? e.message : e);
    return null;
  }

  await handleEvent(admin, event);

  try {
    await admin.from('system_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
  } catch (e) {
    console.error('[events] mark-processed failed:', e instanceof Error ? e.message : e);
  }

  return event;
}
