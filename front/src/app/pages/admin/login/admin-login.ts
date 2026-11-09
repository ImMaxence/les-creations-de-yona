import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminSession } from '../../../core/auth/admin-session';
import { ColorSchemeSwitch } from '../../../core/layout/color-scheme-switch/color-scheme-switch';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';

/** Under the name of the site: what the back-office is for. */
const SECTIONS = ['Recettes', 'Boutique', 'Galerie', 'Mon CAP', 'Sauvegardes'];

/**
 * The door of the back-office: one button, to the Google sign-in. Also where the backend sends a
 * Google account that is not on the admin list (`denied`, from the route).
 */
@Component({
  selector: 'yona-admin-login',
  imports: [ColorSchemeSwitch, Icon, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLogin {
  readonly denied = input(false);

  private readonly session = inject(AdminSession);

  protected readonly sections = SECTIONS;
  /** The browser is leaving for Google: a second tap would change nothing. */
  protected readonly leaving = signal(false);
  protected readonly icon = computed<IconName>(() => (this.denied() ? 'lock' : 'chef-hat'));
  protected readonly title = computed(() => (this.denied() ? 'Accès refusé' : "Espace d'administration"));
  protected readonly text = computed(() =>
    this.denied()
      ? "Ce compte Google n'est pas autorisé à administrer le site. Connectez-vous avec un compte administrateur"
      : 'Connexion réservée aux admins du site, via Google',
  );
  protected readonly action = computed(() => (this.denied() ? 'Utiliser un autre compte' : 'Se connecter avec Google'));

  protected signIn(): void {
    this.leaving.set(true);
    this.session.signIn();
  }
}
