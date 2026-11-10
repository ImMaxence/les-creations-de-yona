import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** How a visitor wants the site shown, besides light or dark (page Accessibilité). */
export interface DisplayPreferences {
  textSize: 'normal' | 'large' | 'larger';
  /** Muted texts and lines as dark as the text. */
  contrast: boolean;
  /** No animation nor transition, whatever the system says. */
  reduceMotion: boolean;
  /** A plain sans-serif font for all texts, titles included. */
  readableFont: boolean;
  underlineLinks: boolean;
  /** Line, letter and word spacing of WCAG 1.4.12. */
  textSpacing: boolean;
}

export const DEFAULT_PREFERENCES: DisplayPreferences = {
  textSize: 'normal',
  contrast: false,
  reduceMotion: false,
  readableFont: false,
  underlineLinks: false,
  textSpacing: false,
};

/** Also read by the inline script of index.html, which applies the choices before the first paint. */
export const PREFERENCES_KEY = 'yona-accessibility';

const TEXT_SIZES: readonly DisplayPreferences['textSize'][] = ['normal', 'large', 'larger'];
const SWITCHES = ['contrast', 'reduceMotion', 'readableFont', 'underlineLinks', 'textSpacing'] as const;

/**
 * The attribute of <html> for each choice, null when it is off: what _accessibility.scss styles.
 * The inline script of index.html writes the same ones (keep both in step).
 */
export function attributesOf(preferences: DisplayPreferences): Record<string, string | null> {
  return {
    'data-text-size': preferences.textSize === 'normal' ? null : preferences.textSize,
    'data-contrast': preferences.contrast ? 'more' : null,
    'data-motion': preferences.reduceMotion ? 'reduce' : null,
    'data-font': preferences.readableFont ? 'readable' : null,
    'data-links': preferences.underlineLinks ? 'underline' : null,
    'data-spacing': preferences.textSpacing ? 'wide' : null,
  };
}

/** What the browser kept, each choice checked on its own: one that does not read is left at its default. */
export function readPreferences(stored: string | null): DisplayPreferences {
  let value: unknown;
  try {
    value = JSON.parse(stored ?? 'null');
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
  const kept = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const preferences: DisplayPreferences = { ...DEFAULT_PREFERENCES };
  if (TEXT_SIZES.includes(kept['textSize'] as DisplayPreferences['textSize'])) {
    preferences.textSize = kept['textSize'] as DisplayPreferences['textSize'];
  }
  for (const key of SWITCHES) {
    if (typeof kept[key] === 'boolean') {
      preferences[key] = kept[key];
    }
  }
  return preferences;
}

export function isDefault(preferences: DisplayPreferences): boolean {
  return (Object.keys(DEFAULT_PREFERENCES) as (keyof DisplayPreferences)[]).every((key) => preferences[key] === DEFAULT_PREFERENCES[key]);
}

/**
 * The visitor's display choices, kept in their browser only and written on <html>, as the light or
 * dark choice (ColorScheme). On the server, the defaults: the choices are only known by the browser.
 */
@Injectable({ providedIn: 'root' })
export class DisplayPreferencesStore {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<DisplayPreferences>(this.isBrowser ? readPreferences(this.stored()) : { ...DEFAULT_PREFERENCES });

  readonly preferences = this.state.asReadonly();

  update(changes: Partial<DisplayPreferences>): void {
    this.apply({ ...this.state(), ...changes });
  }

  reset(): void {
    this.apply({ ...DEFAULT_PREFERENCES });
  }

  private apply(preferences: DisplayPreferences): void {
    this.state.set(preferences);
    for (const [name, value] of Object.entries(attributesOf(preferences))) {
      if (value === null) {
        this.root.removeAttribute(name);
      } else {
        this.root.setAttribute(name, value);
      }
    }
    try {
      if (isDefault(preferences)) {
        localStorage.removeItem(PREFERENCES_KEY);
      } else {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      }
    } catch {
      // Storage disabled: the choices last until the page is left
    }
  }

  private stored(): string | null {
    try {
      return localStorage.getItem(PREFERENCES_KEY);
    } catch {
      return null;
    }
  }
}

/** Animations to leave out: asked by the system, or chosen on the page Accessibilité. */
export function prefersReducedMotion(document: Document): boolean {
  return (
    document.documentElement.getAttribute('data-motion') === 'reduce' ||
    !!document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}
