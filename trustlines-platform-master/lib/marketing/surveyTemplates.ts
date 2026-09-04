export const SURVEY_TEMPLATES = ['general', 'none', 'soccer_challenge'] as const;
export type SurveyTemplate = typeof SURVEY_TEMPLATES[number];
export const SURVEY_TEMPLATE_LABELS: Record<SurveyTemplate, string> = {
  general: 'General Survey (T Lines Store Passport — default, use for any link)',
  none: 'None yet — link works, page shows "not ready"',
  soccer_challenge: 'Soccer Challenge (NACS gamified form)',
};
