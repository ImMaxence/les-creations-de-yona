import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { GuardsCheckEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ADMIN_PATH } from '../../shared/routing/links';

/**
 * New versions of the site. Pages open at once from the service worker's copy, even offline, so a
 * new version is downloaded in the background and taken at the next change of page: a full load
 * instead of a navigation in the app, without interrupting a reading. Not in the back-office,
 * where it would skip the warning about a recipe not saved. The installed app, often left open
 * for days, looks again for a new version each time it comes back on screen.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private versionReady = false;

  listen(): void {
    if (!this.isBrowser || !this.swUpdate.isEnabled) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() => (this.versionReady = true));
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
        this.swUpdate.checkForUpdate().catch(() => undefined);
      }
    });
  }
}
