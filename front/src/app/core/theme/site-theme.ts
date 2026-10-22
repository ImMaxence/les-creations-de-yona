import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, REQUEST, effect, inject, linkedSignal, signal } from '@angular/core';
import { Api } from '../api/generated/api';
import { getTheme } from '../api/generated/fn/theme/get-theme';
import { updateTheme } from '../api/generated/fn/admin-theme/update-theme';
import { ThemeResponse } from '../api/generated/models/theme-response';
import { ColorScheme, ColorSchemePreference } from './color-scheme';
import { BODY_FONTS, DISPLAY_FONTS } from './theme-fonts';
import { THEME_PRESETS, ThemePalette } from './theme-presets';

export const DEFAULT_THEME: ThemeResponse = {
  preset: 'PATISSERIE_CHIC',
  displayFont: 'FRAUNCES',
  bodyFont: 'INTER',
  radiusPx: 16,
};

/**
 * Look of the site chosen by the admin (colors, fonts, corner radius), loaded before the first
 * render and written as CSS custom properties on <html>: the server-rendered page already has it,
 * without any flash. Each color holds its light and dark value (light-dark()), so the visitor's
 * light or dark choice needs no other change.
 */
@Injectable({ providedIn: 'root' })
export class SiteTheme {
  private readonly api = inject(Api);
  private readonly document = inject(DOCUMENT);
  private readonly colorScheme = inject(ColorScheme);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  // At build time (route extraction), the app runs on the server without any request nor API
  private readonly isBuildTime = this.isServer && inject(REQUEST, { optional: true }) === null;

  private readonly saved = signal<ThemeResponse>(DEFAULT_THEME);
  /** The saved theme, or the one the admin is trying out in the back-office. */
  private readonly shown = linkedSignal(() => this.saved());

  readonly theme = this.saved.asReadonly();

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      // Follows a preview in the back-office and the visitor's light or dark choice
      effect(() => this.write(this.shown(), this.colorScheme.preference()));
    }
  }

  async load(): Promise<void> {
    if (this.isBuildTime) {
      return;
    }
    // An unavailable API must not take the site down: the default look is used instead
    this.saved.set(await this.api.invoke(getTheme).catch(() => DEFAULT_THEME));
    if (this.isServer) {
      this.write(this.saved(), 'auto');
    }
  }

  /** Shows a theme on the whole site without saving it. */
  preview(theme: ThemeResponse): void {
    this.shown.set(theme);
  }

  /** Back to the saved theme, after a preview. */
  cancelPreview(): void {
    this.shown.set(this.saved());
  }

  async save(theme: ThemeResponse): Promise<void> {
    this.saved.set(await this.api.invoke(updateTheme, { body: theme }));
  }

  private write(theme: ThemeResponse, preference: ColorSchemePreference): void {
    const preset = THEME_PRESETS[theme.preset];
    this.document.documentElement.setAttribute('style', themeStyle(theme));
    this.writeBrowserColor(preset.light.bg, preset.dark.bg, preference);
  }

  /** Color of the browser bar and of the installed app's status bar: the page background. */
  private writeBrowserColor(light: string, dark: string, preference: ColorSchemePreference): void {
    const head = this.document.head;
    head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
    const colors: [string, string | null][] =
      preference === 'auto'
        ? [
            [light, '(prefers-color-scheme: light)'],
            [dark, '(prefers-color-scheme: dark)'],
          ]
        : [[preference === 'dark' ? dark : light, null]];
    for (const [color, media] of colors) {
      const meta = this.document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', color);
      if (media) {
        meta.setAttribute('media', media);
      }
      head.appendChild(meta);
    }
  }
}

/** --color-bg: light-dark(#fcf9f5, #1d1411); … --font-display: …; --radius-base: 16px */
export function themeStyle(theme: ThemeResponse): string {
  const { light, dark } = THEME_PRESETS[theme.preset];
  const colors = (Object.keys(light) as (keyof ThemePalette)[]).map(
    (key) => `--color-${toKebabCase(key)}: light-dark(${light[key]}, ${dark[key]})`,
  );
  return [
    ...colors,
    `--font-display: ${DISPLAY_FONTS[theme.displayFont].family}`,
    `--font-body: ${BODY_FONTS[theme.bodyFont].family}`,
    `--radius-base: ${theme.radiusPx}px`,
  ].join('; ');
}

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
