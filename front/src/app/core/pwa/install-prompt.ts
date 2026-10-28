import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { storedSignal } from '../kitchen/stored-signal';

/** Chromium only, not in the TypeScript DOM library. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Chromium only (Android): the site's own app, when installed, listed in the manifest's related_applications. */
interface RelatedAppsNavigator extends Navigator {
  getInstalledRelatedApps?: () => Promise<unknown[]>;
  /** Safari on iPhone and iPad, opened from the home screen. */
  standalone?: boolean;
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

const INSTALLED_KEY = 'yona-app-installed';

/**
 * Browsers built into social apps, which cannot install a site: the visitor coming from a link
 * on Instagram or TikTok has to open the page in Safari or Chrome first.
 */
const IN_APP_BROWSERS: [RegExp, string][] = [
  [/Instagram/, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/Pinterest/, 'Pinterest'],
  [/Snapchat/, 'Snapchat'],
  [/\bLine\//, 'Line'],
];

/**
 * Installation of the site as an app (PWA). Chrome, Edge and Android browsers offer their own
 * install prompt, kept here to be shown from a button; Safari has none, the install page explains
 * the manual steps instead.
 */
@Injectable({ providedIn: 'root' })
export class InstallPrompt {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);

  /** The browser can show its install prompt right now. */
  readonly canPrompt = computed(() => this.deferredPrompt() !== null);
  /** Opened as an installed app right now. */
  readonly standalone = signal(false);
  /**
   * Installed on this device, also seen from a browser tab: opened as an app here once, installed
   * from the site, or found by the browser. Forgotten when the browser offers to install it again,
   * which it only does once it has been removed. On iPhone, Safari and the app keep separate data:
   * Safari cannot know.
   */
  private readonly seenInstalled = storedSignal(INSTALLED_KEY, false, (value) => typeof value === 'boolean');
  readonly installed = computed(() => this.standalone() || this.seenInstalled());
  readonly platform = signal<DevicePlatform | null>(null);
  /** The social app whose built-in browser shows the site ("Instagram"), null in a real browser. */
  readonly inAppBrowser = signal<string | null>(null);

  /** Starts listening as soon as the app boots: the browser sends its prompt only once. */
  listen(): void {
    if (!this.isBrowser) {
      return;
    }
    const browser = navigator as RelatedAppsNavigator;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt.set(event as BeforeInstallPromptEvent);
      // Offered only when the app is not installed: removed since it was seen
      this.seenInstalled.set(false);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
      this.seenInstalled.set(true);
    });
    // Also when the browser moves the tab into the app's window (computer)
    const standalone = matchMedia('(display-mode: standalone)');
    const updateStandalone = () => {
      this.standalone.set(standalone.matches || browser.standalone === true);
      if (this.standalone()) {
        this.seenInstalled.set(true);
      }
    };
    standalone.addEventListener('change', updateStandalone);
    updateStandalone();
    browser
      .getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.length) {
          this.seenInstalled.set(true);
        }
      })
      .catch(() => undefined);
    this.platform.set(detectPlatform());
    this.inAppBrowser.set(IN_APP_BROWSERS.find(([pattern]) => pattern.test(navigator.userAgent))?.[1] ?? null);
  }

  async prompt(): Promise<void> {
    const prompt = this.deferredPrompt();
    if (!prompt) {
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // A prompt can only be used once
    this.deferredPrompt.set(null);
    if (outcome === 'accepted') {
      this.seenInstalled.set(true);
    }
  }
}

function detectPlatform(): DevicePlatform {
  const userAgent = navigator.userAgent;
  // iPadOS presents itself as a Mac: a touch screen gives it away
  const isIpad = /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(userAgent) || isIpad) {
    return 'ios';
  }
  return /Android/.test(userAgent) ? 'android' : 'desktop';
}
