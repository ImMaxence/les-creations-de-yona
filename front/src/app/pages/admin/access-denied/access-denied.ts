import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminSession } from '../../../core/auth/admin-session';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/** Where the backend sends a Google account that is not on the admin list. */
@Component({
  selector: 'yona-access-denied',
  imports: [Icon, RouterLink, Button],
  template: `
    <section class="container error-page">
      <div class="error-page__icon enter" aria-hidden="true">
        <svg yonaIcon="lock" [size]="48" [strokeWidth]="1.25"></svg>
      </div>
      <p class="eyebrow enter" style="--delay: 80ms">Back-office</p>
      <h1 class="enter" style="--delay: 140ms">Accès refusé</h1>
      <p class="error-page__text enter" style="--delay: 200ms">
        Ce compte Google n'est pas autorisé à administrer le site. Connectez-vous avec un compte
        administrateur.
      </p>
      <div class="error-page__actions enter" style="--delay: 260ms">
        <button yonaButton type="button" (click)="session.signIn()">Utiliser un autre compte</button>
        <a yonaButton variant="secondary" routerLink="/">Retour à l'accueil</a>
      </div>
    </section>
  `,
  styleUrl: '../../error-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AccessDenied {
  protected readonly session = inject(AdminSession);
}
