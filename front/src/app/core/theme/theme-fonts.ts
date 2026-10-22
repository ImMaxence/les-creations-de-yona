import { ThemeResponse } from '../api/generated/models/theme-response';

export type DisplayFontId = ThemeResponse['displayFont'];
export type BodyFontId = ThemeResponse['bodyFont'];

interface FontChoice {
  readonly label: string;
  /** CSS font-family, with fallbacks of the same style while the font loads. */
  readonly family: string;
}

/**
 * Self-hosted fonts (Fontsource, SIL Open Font License), declared in angular.json. Every one is
 * declared with @font-face, but browsers only download the ones a page actually uses.
 */
export const DISPLAY_FONTS: Record<DisplayFontId, FontChoice> = {
  FRAUNCES: { label: 'Fraunces', family: "'Fraunces Variable', Georgia, serif" },
  PLAYFAIR_DISPLAY: { label: 'Playfair Display', family: "'Playfair Display Variable', Georgia, serif" },
  CORMORANT_GARAMOND: { label: 'Cormorant Garamond', family: "'Cormorant Garamond Variable', Georgia, serif" },
  DANCING_SCRIPT: { label: 'Dancing Script', family: "'Dancing Script Variable', 'Brush Script MT', cursive" },
  QUICKSAND: { label: 'Quicksand', family: "'Quicksand Variable', system-ui, sans-serif" },
};

export const BODY_FONTS: Record<BodyFontId, FontChoice> = {
  INTER: { label: 'Inter', family: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  NUNITO: { label: 'Nunito', family: "'Nunito Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  DM_SANS: { label: 'DM Sans', family: "'DM Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  SOURCE_SANS_3: {
    label: 'Source Sans 3',
    family: "'Source Sans 3 Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  LORA: { label: 'Lora', family: "'Lora Variable', Georgia, serif" },
};
