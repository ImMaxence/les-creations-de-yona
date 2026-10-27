import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { Consent } from '../analytics/consent';
import { storedSignal } from '../kitchen/stored-signal';
import { ADMIN_PATH, INSTALL_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { InstallPrompt } from './install-prompt';

const STORAGE_KEY = 'yona-install-banner-dismissed';
/** "Plus tard": asked again a month later. */
const QUIET_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function isTime(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

/**
 * "Installer l'application", offered at the bottom of the screen only when the browser can install
 * it right now (Chrome, Edge, Android): not on iPhone, where it takes manual steps (the install
 * page explains them), nor once installed. Waits for the cookie question to be answered, and
 * leaves the admin and the install page alone.
 */
@Component({
  selector: 'yona-install-banner',
  imports: [Button, Icon, RouterLink],
  template: `
    @if (shown()) {
      <section class="banner" role="region" aria-labelledby="install-banner-title" animate.enter="banner--enter">
        <svg class="banner__icon" yonaIcon="smartphone" [size]="26" [strokeWidth]="1.75"></svg>
        <div class="banner__text">
          <h2 id="install-banner-title" class="banner__title">Les recettes à portée de main</h2>
          <p>
            Installez l'application : une icône sur l'écran d'accueil, les recettes lisibles hors connexion.
            <a [routerLink]="installPath">En savoir plus</a>
          </p>
        </div>
        <div class="banner__actions">
          <button yonaButton variant="secondary" type="button" (click)="dismiss()">Plus tard</button>
          <button yonaButton type="button" (click)="install()">Installer</button>
        </div>
      </section>
    }
  `,
  styleUrl: './install-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallBanner {
  private readonly installPrompt = inject(InstallPrompt);
  private readonly consent = inject(Consent);
  private readonly dismissedAt = storedSignal<number | null>(STORAGE_KEY, null, isTime);
  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: '' },
  );
  protected readonly installPath = INSTALL_PATH;

  protected readonly shown = computed(() => {
    const dismissedAt = this.dismissedAt();
    const url = this.url();
    return (
      this.installPrompt.canPrompt() &&
      !this.installPrompt.installed() &&
      !this.consent.bannerOpen() &&
      (dismissedAt === null || Date.now() - dismissedAt > QUIET_FOR_MS) &&
      !url.startsWith(ADMIN_PATH) &&
      !url.startsWith(INSTALL_PATH)
    );
  });

  protected dismiss(): void {
    this.dismissedAt.set(Date.now());
  }

  protected async install(): Promise<void> {
    await this.installPrompt.prompt();
    // Refused in the browser's own prompt: not asked again before a month either
    if (!this.installPrompt.installed()) {
      this.dismiss();
    }
  }
}
