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
  BODONI_MODA: { label: 'Bodoni Moda', family: "'Bodoni Moda Variable', Didot, Georgia, serif" },
  CINZEL: { label: 'Cinzel', family: "'Cinzel Variable', 'Trajan Pro', Georgia, serif" },
  EB_GARAMOND: { label: 'EB Garamond', family: "'EB Garamond Variable', Garamond, Georgia, serif" },
  CAVEAT: { label: 'Caveat', family: "'Caveat Variable', 'Brush Script MT', cursive" },
  COMFORTAA: { label: 'Comfortaa', family: "'Comfortaa Variable', system-ui, sans-serif" },
  UNBOUNDED: { label: 'Unbounded', family: "'Unbounded Variable', system-ui, sans-serif" },
  SYNE: { label: 'Syne', family: "'Syne Variable', system-ui, sans-serif" },
  FREDOKA: { label: 'Fredoka', family: "'Fredoka Variable', system-ui, sans-serif" },
  JOSEFIN_SANS: { label: 'Josefin Sans', family: "'Josefin Sans Variable', 'Futura', system-ui, sans-serif" },
  KALNIA: { label: 'Kalnia', family: "'Kalnia Variable', Didot, Georgia, serif" },
  BRICOLAGE_GROTESQUE: { label: 'Bricolage Grotesque', family: "'Bricolage Grotesque Variable', system-ui, sans-serif" },
  NEWSREADER: { label: 'Newsreader', family: "'Newsreader Variable', Georgia, serif" },
  SHANTELL_SANS: { label: 'Shantell Sans', family: "'Shantell Sans Variable', 'Comic Sans MS', cursive" },
  GRANDSTANDER: { label: 'Grandstander', family: "'Grandstander Variable', system-ui, sans-serif" },
  IMBUE: { label: 'Imbue', family: "'Imbue Variable', Didot, Georgia, serif" },
  PLAYPEN_SANS: { label: 'Playpen Sans', family: "'Playpen Sans Variable', 'Comic Sans MS', cursive" },
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
  OPEN_SANS: { label: 'Open Sans', family: "'Open Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  MONTSERRAT: { label: 'Montserrat', family: "'Montserrat Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  WORK_SANS: { label: 'Work Sans', family: "'Work Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  MANROPE: { label: 'Manrope', family: "'Manrope Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  MERRIWEATHER: { label: 'Merriweather', family: "'Merriweather Variable', Georgia, serif" },
  RALEWAY: { label: 'Raleway', family: "'Raleway Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  RUBIK: { label: 'Rubik', family: "'Rubik Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  OUTFIT: { label: 'Outfit', family: "'Outfit Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  FIGTREE: { label: 'Figtree', family: "'Figtree Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  CRIMSON_PRO: { label: 'Crimson Pro', family: "'Crimson Pro Variable', Georgia, serif" },
  BITTER: { label: 'Bitter', family: "'Bitter Variable', Georgia, serif" },
};
