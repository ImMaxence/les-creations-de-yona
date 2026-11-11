import { CustomColors } from '../api/generated/models/custom-colors';
import { CustomPalette } from '../api/generated/models/custom-palette';
import { ThemePalette } from './theme-presets';

const DANGER_LIGHT = '#a3341c';
const DANGER_DARK = '#f08c78';

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hex([red, green, blue]: Rgb): string {
  return `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/** {@code share} of the first color, the rest of the second, as CSS color-mix() in sRGB. */
export function mix(first: string, second: string, share: number): string {
  const a = rgb(first);
  const b = rgb(second);
  return hex([0, 1, 2].map((index) => a[index]! * share + b[index]! * (1 - share)) as Rgb);
}

/** Relative luminance, WCAG 2. */
function luminance(color: string): number {
  const [red, green, blue] = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** From 1 (none) to 21 (black on white); text needs 4.5 at least. */
export function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * The whole palette of a scheme from the four colors chosen by hand: the muted text between the
 * text and the background, the accent pressed towards the text, the text on the accent the more
 * readable of the background and the text, the decoration a soft accent.
 */
export function customPalette(chosen: CustomPalette, scheme: 'light' | 'dark'): ThemePalette {
  const { bg, surface, text, accent } = chosen;
  return {
    bg,
    surface,
    text,
    textMuted: mix(text, bg, 0.72),
    accent,
    accentStrong: mix(accent, text, 0.78),
    onAccent: contrast(accent, bg) >= contrast(accent, text) ? bg : text,
    decor: mix(accent, bg, 0.55),
    danger: scheme === 'light' ? DANGER_LIGHT : DANGER_DARK,
    shadow: scheme === 'light' ? text : '#000000',
  };
}

/** A start for "Personnalisé": the colors of a theme of the site. */
export function customColorsFrom(light: ThemePalette, dark: ThemePalette): CustomColors {
  const pick = ({ bg, surface, text, accent }: ThemePalette): CustomPalette => ({ bg, surface, text, accent });
  return { light: pick(light), dark: pick(dark) };
}

/** What would be hard to read, in French; empty when all is readable. */
export function readabilityProblems(colors: CustomPalette): string[] {
  const problems: string[] = [];
  if (contrast(colors.text, colors.bg) < 4.5 || contrast(colors.text, colors.surface) < 4.5) {
    problems.push('Le texte manque de contraste avec le fond ou les cartes');
  }
  if (contrast(colors.accent, colors.bg) < 3) {
    problems.push('L’accent (boutons, liens) se distingue mal du fond');
  }
  return problems;
}
