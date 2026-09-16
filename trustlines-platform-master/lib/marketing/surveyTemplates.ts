export const SURVEY_TEMPLATES = ['general', 'quick', 'none', 'soccer_challenge'] as const;
export type SurveyTemplate = typeof SURVEY_TEMPLATES[number];
export const SURVEY_TEMPLATE_LABELS: Record<SurveyTemplate, string> = {
  general: 'General Survey (T Lines project brief form — default, use for any link)',
  quick: 'Quick Survey (short 3-step form — name/contact, project, timing + note)',
  none: 'None yet — link works, page shows "not ready"',
  soccer_challenge: 'Soccer Challenge (NACS gamified form)',
};
