import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type ColorSchemePreference = 'light' | 'auto' | 'dark';

/** Also read by the inline script of index.html, which applies the choice before the first paint. */
const STORAGE_KEY = 'yona-color-scheme';
const ATTRIBUTE = 'data-color-scheme';

/**
 * Light or dark display, chosen by each visitor and kept in their browser only. "Auto" (default)
 * follows the system setting. The choice is an attribute on <html>, which _root.scss turns into
 * the CSS color-scheme that light-dark() colors follow.
 */
@Injectable({ providedIn: 'root' })
export class ColorScheme {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Server: always "auto", the choice is only known by the browser
  private readonly preferenceState = signal<ColorSchemePreference>(this.isBrowser ? this.current() : 'auto');

  readonly preference = this.preferenceState.asReadonly();

  set(preference: ColorSchemePreference): void {
    this.preferenceState.set(preference);
    if (preference === 'auto') {
      this.root.removeAttribute(ATTRIBUTE);
    } else {
      this.root.setAttribute(ATTRIBUTE, preference);
    }
    try {
      if (preference === 'auto') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      // Storage disabled (private browsing on some browsers): the choice lasts until the page is left
    }
  }

  /** As applied by the inline script of index.html. */
  private current(): ColorSchemePreference {
    const applied = this.root.getAttribute(ATTRIBUTE);
    return applied === 'light' || applied === 'dark' ? applied : 'auto';
  }
}
