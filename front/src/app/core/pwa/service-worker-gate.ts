import { isPlatformBrowser } from '@angular/common';
import { ApplicationRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { InstallPrompt } from './install-prompt';

/** The copies of the site kept by Angular's service worker ("ngsw:/…"), and of the API kept by the page (api-cache.ts). */
const OFFLINE_COPIES = /^ngsw:|^yona-api$/;

/** As Angular's registerWhenStable:30000: once the page has settled, at the latest after 30 seconds. */
const REGISTER_AT_THE_LATEST_MS = 30_000;

/**
 * The service worker only where it is of use:
 * - the installed app: its pages open at once from the device, even offline;
 * - a device that receives notifications: Web Push needs one (registered on the tap that turns them on).
 * In a browser tab, nothing else: every page comes from the server, always the version online,
 * without the "nouvelle version" toast after each deployment. The worker installed in a tab by an
 * earlier version (until 2.5) is removed there, then its copies once it no longer serves the page.
 * The installed app and the browser share one worker on Android and on a computer: a tab of a device
 * where the app is installed keeps it.
 */
@Injectable({ providedIn: 'root' })
export class ServiceWorkerGate {
  private readonly appRef = inject(ApplicationRef);
  private readonly installPrompt = inject(InstallPrompt);
  private readonly supported = isPlatformBrowser(inject(PLATFORM_ID)) && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  private decision: Promise<boolean> | null = null;
  private allowRegistration!: () => void;
  private readonly registrationAllowed = new Promise<void>((resolve) => (this.allowRegistration = resolve));

  /** For provideServiceWorker: Angular registers the worker when this emits, never if it does not. */
  registrationStrategy(): Observable<void> {
    void this.kept();
    return from(this.registrationAllowed);
  }

  /** Whether this page keeps a service worker. */
  kept(): Promise<boolean> {
    this.decision ??= this.supported ? this.decide() : Promise.resolve(false);
    return this.decision;
  }

  /** Web Push needs the worker: registered now, even in a tab, and waited for until it is active. */
  async register(): Promise<void> {
    if (!this.supported) {
      return;
    }
    // Not while the worker of an earlier version is being removed
    await this.kept();
    this.allowRegistration();
    await navigator.serviceWorker.ready;
  }

  private async decide(): Promise<boolean> {
    const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
    // installed: opened as the app right now, or once on this device (InstallPrompt.listen, run before)
    if (this.installPrompt.installed() || (await hasPushSubscription(registration))) {
      void Promise.race([this.appRef.whenStable(), delay(REGISTER_AT_THE_LATEST_MS)]).then(() => this.allowRegistration());
      return true;
    }
    if (registration) {
      // Its copies stay until the next page load: it still serves this one, and would reload it without them
      await registration.unregister().catch(() => false);
    } else if (!navigator.serviceWorker.controller) {
      await removeOfflineCopies();
    }
    return false;
  }
}

async function hasPushSubscription(registration: ServiceWorkerRegistration | undefined): Promise<boolean> {
  if (!registration?.pushManager) {
    return false;
  }
  return !!(await registration.pushManager.getSubscription().catch(() => null));
}

async function removeOfflineCopies(): Promise<void> {
  if (typeof caches === 'undefined') {
    return;
  }
  const names = await caches.keys().catch(() => [] as string[]);
  await Promise.all(names.filter((name) => OFFLINE_COPIES.test(name)).map((name) => caches.delete(name).catch(() => false)));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
