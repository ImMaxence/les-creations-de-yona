import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/ui/button/button';
import { PRIVACY_POLICY_PATH } from '../../shared/routing/links';
import { Analytics } from './analytics';
import { Consent } from './consent';

/**
 * Asks before any audience measurement. Refusing is as easy as accepting (same buttons, same
 * place), and nothing is measured meanwhile. Shown in the browser only: the stored choice is
 * unknown to the server.
 */
@Component({
  selector: 'yona-cookie-banner',
  imports: [RouterLink, Button],
  template: `
    @if (consent.bannerOpen()) {
      <section class="banner" role="region" aria-labelledby="cookie-banner-title" animate.enter="banner--enter">
        <h2 id="cookie-banner-title" class="banner__title">Mesure d'audience</h2>
        <p class="banner__text">
          Avec votre accord, Google Analytics mesure la fréquentation du site (pages vues, appareil, pays),
          pour savoir quelles recettes vous plaisent. Aucune publicité. Vous pouvez changer d'avis à tout moment
          avec « Gestion des cookies », en bas de chaque page.
          <a [routerLink]="privacyPolicyPath">En savoir plus</a>
        </p>
        <div class="banner__actions">
          <button yonaButton variant="secondary" type="button" (click)="consent.refuse()">Refuser</button>
          <button yonaButton variant="secondary" type="button" (click)="consent.accept()">Accepter</button>
        </div>
      </section>
    }
  `,
  styleUrl: './cookie-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieBanner {
  protected readonly consent = inject(Consent);
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;

  constructor() {
    const analytics = inject(Analytics);
    afterNextRender(() => {
      this.consent.init();
      analytics.start();
    });
  }
}
