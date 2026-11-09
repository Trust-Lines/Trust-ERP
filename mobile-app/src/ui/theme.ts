// Trust Lines DS · Light Mode — the same tokens as mobile-design/source/mobile-mockups.html :root
// (Light Mode.tokens.json). Names match the Figma variables.
export const C = {
  P950: '#0A0C0F', P800: '#1F252D', P700: '#343D4B', P600: '#495669', P500: '#5E6F87', P400: '#7888A1', P300: '#96A3B6', P200: '#B4BDCB', P100: '#D2D7E0', P50: '#F0F2F5',
  S950: '#090C11', S800: '#1A2533', S700: '#2B3D55', S600: '#3C5577', S500: '#4D6E98', S400: '#6787B2', S300: '#88A2C3', S200: '#AABCD4', S100: '#CCD7E5', S50: '#EEF2F6',
  A950: '#1A0600', A800: '#4D1200', A700: '#801F00', A600: '#B32B00', A500: '#E63700', A400: '#FF511A', A300: '#FF774D', A200: '#FF9E80', A100: '#FFC5B3', A50: '#FFECE5',
  G700: '#3D3D43', G100: '#D7D7DB', G50: '#F2F2F3',
  successD: '#216B2E', success: '#38A648', successL: '#E4F5E7',
  errorD: '#922025', error: '#D52D31', errorL: '#FBE7E7',
  warningD: '#805000', warning: '#F4A717', warningL: '#FFF2D8',
  infoD: '#19477D', info: '#2A6FBE', infoL: '#E5F0FA',
  white: '#FFFFFF',
} as const;

// Basic UI Colors (light) — what the mockups actually reference.
export const UI = {
  surface: C.P50,        // screen background (--bg)
  card: C.white,         // --card / elevated
  heading: C.P500,
  body: C.P500,
  secondary: C.P400,
  disabled: C.P300,
  ink: C.P800,           // dark cards, chat bubbles, selected chips
  btnPrimary: C.S700,
  cta: C.A400,
  link: C.A600,
  navActive: C.S500,
  border: C.P100,
  inputBorder: C.P200,
  hover: C.P100,
  focus: C.S500,         // mockup focus ring on inputs (--blue)
} as const;

export const F = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

/** chip / ico tones: Info (default) · Success · Error · Warning · Accent · Neutral · Dark */
export type Tone = 'i' | 'g' | 'r' | 'a' | 'o' | 'n' | 'k';
export const TONE: Record<Tone, { bg: string; fg: string }> = {
  i: { bg: C.infoL, fg: C.infoD },
  g: { bg: C.successL, fg: C.successD },
  r: { bg: C.errorL, fg: C.errorD },
  a: { bg: C.warningL, fg: C.warningD },
  o: { bg: C.A50, fg: C.A700 },
  n: { bg: C.G100, fg: C.G700 },
  k: { bg: C.S700, fg: C.white },
};
// .ico uses S50/S600 for the default tone and A600 for accent.
export const ICO_TONE: Record<Tone, { bg: string; fg: string }> = {
  ...TONE, i: { bg: C.S50, fg: C.S600 }, o: { bg: C.A50, fg: C.A600 },
};

export const shadowCard = { shadowColor: '#141E2D', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } as const;
