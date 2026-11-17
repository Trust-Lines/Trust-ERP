// Page-scoped styles for the New / Edit project wizard (also used by the campaign form and the
// lead capture wizard). Figma "Project Detail" (node 253:11944): semantic --ui-* / --status-t*
// tokens, so light and dark both come from app/globals.css instead of hard-coded slate colours.
//
// One file per section; the order below is the cascade order, so responsive and dark-theme
// overrides stay last.
import { LAYOUT_STYLES } from './layout';
import { QUICK_CREATE_STYLES } from './quickCreate';
import { FIELD_STYLES } from './fields';
import { BUTTON_STYLES } from './buttons';
import { PROGRESS_STYLES } from './progress';
import { FORM_STYLES } from './form';
import { SUMMARY_STYLES } from './summary';
import { RESPONSIVE_STYLES } from './responsive';
import { DARK_THEME_STYLES } from './darkTheme';

export const NEW_PROJECT_STYLES = [
  LAYOUT_STYLES,
  QUICK_CREATE_STYLES,
  FIELD_STYLES,
  BUTTON_STYLES,
  PROGRESS_STYLES,
  FORM_STYLES,
  SUMMARY_STYLES,
  RESPONSIVE_STYLES,
  DARK_THEME_STYLES,
].join('');
