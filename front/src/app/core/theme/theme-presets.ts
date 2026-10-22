import { ThemeResponse } from '../api/generated/models/theme-response';

export type ThemePresetId = ThemeResponse['preset'];

/** Colors of one scheme (light or dark). Each one becomes a CSS custom property --color-*. */
export interface ThemePalette {
  /** Page background. */
  bg: string;
  /** Secondary background: cards, panels, footer, chips. */
  surface: string;
  /** Main text. */
  text: string;
  /** Secondary text, readable on bg and surface (4.5:1 at least). */
  textMuted: string;
  /** Buttons, links and active states (4.5:1 at least on bg). */
  accent: string;
  /** Hover and pressed states of the accent. */
  accentStrong: string;
  /** Text and icons drawn on the accent. */
  onAccent: string;
  /** Decoration only (rings, icons, dots): never text. */
  decor: string;
  /** Destructive actions and errors. */
  danger: string;
  /** Base color of shadows and modal backdrops. */
  shadow: string;
}

export interface ThemePreset {
  readonly label: string;
  readonly light: ThemePalette;
  readonly dark: ThemePalette;
}

const DANGER_LIGHT = '#a3341c';
const DANGER_DARK = '#f08c78';

/**
 * Color themes the admin can pick, each with a light and a dark version tuned by hand.
 * Contrasts checked with WCAG: text ≥ 7:1, muted text and accent ≥ 4.5:1 on bg and surface,
 * onAccent ≥ 4.5:1 on accent.
 */
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  PATISSERIE_CHIC: {
    label: 'Pâtisserie chic',
    light: {
      bg: '#fcf9f5',
      surface: '#f4e7e6',
      text: '#36221c',
      textMuted: '#6e5a52',
      accent: '#8c533e',
      accentStrong: '#6e3f2e',
      onAccent: '#fcf9f5',
      decor: '#d49a99',
      danger: DANGER_LIGHT,
      shadow: '#36221c',
    },
    dark: {
      bg: '#1d1411',
      surface: '#2b1f1b',
      text: '#f4e7e6',
      textMuted: '#c2aea7',
      accent: '#e0a184',
      accentStrong: '#ecbba3',
      onAccent: '#1d1411',
      decor: '#d49a99',
      danger: DANGER_DARK,
      shadow: '#000000',
    },
  },
  TERRACOTTA: {
    label: 'Terracotta',
    light: {
      bg: '#fbf6ee',
      surface: '#efe4d2',
      text: '#2e2420',
      textMuted: '#655c57',
      accent: '#a84b28',
      accentStrong: '#8a3d1f',
      onAccent: '#fbf6ee',
      decor: '#7d8f69',
      danger: DANGER_LIGHT,
      shadow: '#2e2420',
    },
    dark: {
      bg: '#1b1613',
      surface: '#2a221d',
      text: '#f3ebe0',
      textMuted: '#bcb0a5',
      accent: '#e88a63',
      accentStrong: '#f2a584',
      onAccent: '#1b1613',
      decor: '#9db389',
      danger: DANGER_DARK,
      shadow: '#000000',
    },
  },
  PISTACHE: {
    label: 'Pistache',
    light: {
      bg: '#f8faf3',
      surface: '#e8efdc',
      text: '#232b1d',
      textMuted: '#55614b',
      accent: '#4f6b27',
      accentStrong: '#3e551d',
      onAccent: '#f8faf3',
      decor: '#e39bb0',
      danger: DANGER_LIGHT,
      shadow: '#232b1d',
    },
    dark: {
      bg: '#131810',
      surface: '#20281b',
      text: '#edf2e5',
      textMuted: '#a9b79b',
      accent: '#a8cc70',
      accentStrong: '#c2de96',
      onAccent: '#131810',
      decor: '#e39bb0',
      danger: DANGER_DARK,
      shadow: '#000000',
    },
  },
  MYRTILLE: {
    label: 'Myrtille',
    light: {
      bg: '#f8f8fc',
      surface: '#e9e8f5',
      text: '#22203a',
      textMuted: '#5b5878',
      accent: '#4a4ea6',
      accentStrong: '#373a86',
      onAccent: '#f8f8fc',
      decor: '#b8a2e2',
      danger: DANGER_LIGHT,
      shadow: '#22203a',
    },
    dark: {
      bg: '#141320',
      surface: '#211f31',
      text: '#ecebf8',
      textMuted: '#aba8c8',
      accent: '#a2a6f2',
      accentStrong: '#bec1f7',
      onAccent: '#141320',
      decor: '#b8a2e2',
      danger: DANGER_DARK,
      shadow: '#000000',
    },
  },
  CARAMEL: {
    label: 'Caramel',
    light: {
      bg: '#fffaf2',
      surface: '#f6e9d2',
      text: '#33261a',
      textMuted: '#67563f',
      accent: '#8f5312',
      accentStrong: '#74430e',
      onAccent: '#fffaf2',
      decor: '#e0ae55',
      danger: DANGER_LIGHT,
      shadow: '#33261a',
    },
    dark: {
      bg: '#1a140d',
      surface: '#2a2016',
      text: '#f7ecdc',
      textMuted: '#c4b39c',
      accent: '#e8a95c',
      accentStrong: '#f2c283',
      onAccent: '#1a140d',
      decor: '#e0ae55',
      danger: DANGER_DARK,
      shadow: '#000000',
    },
  },
};
