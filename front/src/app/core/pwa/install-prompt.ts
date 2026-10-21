import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

/** Chromium only, not in the TypeScript DOM library. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

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
  /** Opened as an installed app, or just installed. */
  readonly installed = signal(false);
  readonly platform = signal<DevicePlatform | null>(null);

  /** Starts listening as soon as the app boots: the browser sends its prompt only once. */
  listen(): void {
    if (!this.isBrowser) {
      return;
    }
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt.set(event as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
      this.installed.set(true);
    });
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    this.installed.set(standalone);
    this.platform.set(detectPlatform());
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
      this.installed.set(true);
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
