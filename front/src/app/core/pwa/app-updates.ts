import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { GuardsCheckEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ADMIN_PATH } from '../../shared/routing/links';
import { Toaster } from '../notifications/toaster';
import { isNewerThanFront } from '../version';

/** A new version looked for at most this often when the API keeps saying the page is behind. */
const CHECK_INTERVAL_MS = 30_000;

/**
 * New versions of the site. Pages open at once from the service worker's copy, even offline, so a
 * new version is downloaded in the background, then:
 * - offered at once ("Mettre à jour" in a toast, which stays until used or closed);
 * - taken anyway at the next change of page: a full load instead of a navigation in the app.
 * The back-office is not served by the service worker (ngsw-config.json): always the version on
 * the server, so no toast there, the copy for the public pages brought up to date silently; unless
 * it was opened during a deployment, before the new front.
 * Every answer of the API gives the version of the backend (X-App-Version, versionCheckInterceptor):
 * newer than this page, the service worker looks for the new version at once instead of waiting.
 * The installed app, often left open for days, also looks again when it comes back on screen, and
 * when the connection comes back.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly toaster = inject(Toaster);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private versionReady = false;
  private offered = false;
  /** The backend said it is newer than this page. */
  private behind = false;
  private lastCheck = 0;

  listen(): void {
    if (!this.isBrowser || !this.swUpdate.isEnabled) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() => this.onVersionReady());
    // Its copy of the site is broken (files removed from the browser's storage): only a reload repairs it
    this.swUpdate.unrecoverable.subscribe(() => this.document.location.reload());

    this.router.events
      .pipe(filter((event): event is GuardsCheckEnd => event instanceof GuardsCheckEnd && event.shouldActivate))
      .subscribe((event) => {
        if (this.versionReady && !event.urlAfterRedirects.startsWith(ADMIN_PATH)) {
          this.document.location.assign(event.urlAfterRedirects);
        }
      });

    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        this.check();
      }
    });
    this.document.defaultView?.addEventListener('online', () => this.check());
  }

  /** Version of the backend read on an answer of the API; newer than this page, the new one is looked for. */
  backendVersion(version: string | null): void {
    if (!this.isBrowser || this.versionReady || !isNewerThanFront(version)) {
      return;
    }
    this.behind = true;
    if (this.swUpdate.isEnabled && this.document.defaultView?.navigator.serviceWorker?.controller) {
      // Deployed after the backend, the new front may take a minute to come: looked for again later
      if (Date.now() - this.lastCheck >= CHECK_INTERVAL_MS) {
        this.check();
      }
    } else {
      // No service worker serves this page (first visit, blocked): a reload fetches it from the server
      this.offer();
    }
  }

  private check(): void {
    this.lastCheck = Date.now();
    this.swUpdate.checkForUpdate().catch(() => undefined);
  }

  private onVersionReady(): void {
    if (this.inBackOffice() && !this.behind) {
      // Already the version of the server: the copy kept for the public pages follows, without a word
      this.swUpdate.activateUpdate().catch(() => undefined);
      return;
    }
    this.versionReady = true;
    this.offer();
  }

  private offer(): void {
    if (this.offered) {
      return;
    }
    this.offered = true;
    this.toaster.info('Une nouvelle version du site est prête', {
      icon: 'refresh-cw',
      persistent: true,
      action: { label: 'Mettre à jour', run: () => this.document.location.reload() },
    });
  }

  private inBackOffice(): boolean {
    return this.router.url.startsWith(ADMIN_PATH);
  }
}
