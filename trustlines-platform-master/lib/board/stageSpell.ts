// Dashboard stage history (migration 157) — the browser-safe part: a card's time in one board
// step and the overlap test the dashboard's step + From / To filter uses.

/** A card's time in one step, by day (yyyy-mm-dd, both ends included). */
export interface StageSpell { stage: string; from: string; to: string }

/** True when the card was in `stage` on some day between from and to ('' = open end). */
export function wasInStage(spells: StageSpell[] | undefined, stage: string, from: string, to: string): boolean {
  return !!spells?.some(s => s.stage === stage && (!to || s.from <= to) && (!from || s.to >= from));
}
