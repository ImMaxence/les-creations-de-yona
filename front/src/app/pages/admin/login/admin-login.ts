import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { getAccessLink } from '../../../core/api/generated/fn/authentication/get-access-link';
import { getSignInMethods } from '../../../core/api/generated/fn/authentication/get-sign-in-methods';
import { SignInMethods } from '../../../core/api/generated/models/sign-in-methods';
import { AdminSession, SignInProvider } from '../../../core/auth/admin-session';
import { PasskeyClient } from '../../../core/auth/passkey-client';
import { passkeysSupported } from '../../../core/auth/passkeys';
import { ColorSchemeSwitch } from '../../../core/layout/color-scheme-switch/color-scheme-switch';
import { parisDateTime } from '../../../shared/format/paris-time';
import { remaining, tickingNow } from '../../../shared/format/remaining';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';
import { ProviderLogo } from './provider-logo';

/** Under the name of the site: what the back-office is for. */
const SECTIONS = ['Recettes', 'Boutique', 'Galerie', 'Mon CAP', 'Sauvegardes'];

/** Why someone was not let in, from the end of the address the API sends them to (AccountSignIn.Refusal). */
const REFUSALS: Record<string, string> = {
  inconnu:
    "Ce compte n'est relié à aucun admin du site. Utilisez le compte relié au vôtre, une passkey, ou demandez une invitation à un admin",
  desactive: 'Ce compte a été désactivé. Un autre admin peut le réactiver',
  lien: "Ce lien n'est plus valable : il a déjà servi, a expiré ou a été remplacé. Demandez-en un nouveau à un admin",
  'deja-pris': 'Ce compte est déjà relié à un autre admin du site : choisissez-en un autre',
  annule: "La connexion n'a pas abouti. Réessayez",
};

/** Google always, Microsoft when the API offers it: before it answers, Google alone. */
const GOOGLE_ONLY: SignInMethods = { google: true, microsoft: false };

/**
 * The door of the back-office: a passkey, Google, or Microsoft. Also where the backend sends someone
 * it did not let in ({@code denied}, why in {@code raison}), and the page of a link to come in once
 * ({@code token}: an invitation, or a recovery link), where the way in is chosen.
 */
@Component({
  selector: 'yona-admin-login',
  imports: [ColorSchemeSwitch, Icon, ProviderLogo, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLogin {
  readonly denied = input(false);
  /** ?raison= on "Accès refusé". */
  readonly raison = input<string>();
  /** /admin/acces/:token */
  readonly token = input<string>();
  /** ?erreur= on the page of a link: what went wrong with Google or Microsoft. */
  readonly erreur = input<string>();

  private readonly api = inject(Api);
  private readonly session = inject(AdminSession);
  private readonly passkeys = inject(PasskeyClient);
  private readonly router = inject(Router);

  protected readonly sections = SECTIONS;
  protected readonly passkeysSupported = passkeysSupported();
  /** The browser is leaving, or a passkey is being used: a second tap would change nothing. */
  protected readonly busy = signal<SignInProvider | 'passkey' | null>(null);
  protected readonly failure = signal<string | null>(null);

  protected readonly methods = resource({
    loader: () => this.api.invoke(getSignInMethods).catch(() => GOOGLE_ONLY),
  });
  /** The link of the address, for its page; an error when it is no longer valid. */
  protected readonly link = resource({
    params: () => this.token(),
    loader: ({ params }) => this.api.invoke(getAccessLink, { token: params }),
  });

  protected readonly offered = computed(() => this.methods.value() ?? GOOGLE_ONLY);
  protected readonly linkGone = computed(() => !!this.token() && this.link.status() === 'error');

  protected readonly icon = computed<IconName>(() => {
    if (this.token()) {
      return this.linkGone() ? 'lock' : 'key-round';
    }
    return this.denied() ? 'lock' : 'chef-hat';
  });

  protected readonly title = computed(() => {
    const link = this.link.value();
    if (this.token()) {
      if (this.linkGone()) return 'Lien expiré';
      if (!link) return '…';
      return link.purpose === 'INVITATION' ? `Bienvenue${link.name ? ' ' + link.name : ''}` : "Retrouver l'accès";
    }
    return this.denied() ? 'Accès refusé' : "Espace d'administration";
  });

  protected readonly text = computed(() => {
    const link = this.link.value();
    if (this.token()) {
      if (this.linkGone()) return REFUSALS['lien'];
      if (!link) return '';
      return link.purpose === 'INVITATION'
        ? `Vous êtes invité·e à administrer le site, avec l'adresse ${link.email}. Choisissez comment vous vous connecterez : vous pourrez en ajouter d'autres ensuite, dans « Mon compte »`
        : `Ajoutez un moyen de vous connecter au compte ${link.email} : une passkey sur cet appareil, ou un compte Google ou Microsoft`;
    }
    if (this.denied()) {
      return REFUSALS[this.raison() ?? ''] ?? REFUSALS['inconnu'];
    }
    return 'Connexion réservée aux admins du site';
  });

  /** On the page of a link: what went wrong on the way to Google or Microsoft. */
  protected readonly linkError = computed(() => {
    const reason = this.erreur();
    return this.token() && reason ? (REFUSALS[reason] ?? REFUSALS['annule']) : null;
  });

  protected readonly expires = computed(() => {
    const link = this.link.value();
    return link ? parisDateTime(link.expiresAt) : null;
  });

  private readonly now = tickingNow();

  /** The time left of the link, counting down; null once it has expired (the API refuses it then). */
  protected readonly timeLeft = computed(() => {
    const link = this.link.value();
    return link ? remaining(link.expiresAt, this.now()) : null;
  });

  /** A link: making a passkey; otherwise signing in with one the device holds. */
  protected async usePasskey(): Promise<void> {
    this.busy.set('passkey');
    this.failure.set(null);
    const token = this.token();
    const result = token
      ? await this.passkeys.create<{ redirectUrl: string }>(`/api/auth/access-links/${encodeURIComponent(token)}/passkey`)
      : await this.passkeys.signIn();
    if (result.ok) {
      const landing = typeof result.value === 'string' ? result.value : result.value.redirectUrl;
      await this.session.load();
      await this.router.navigateByUrl(landing);
      // Still here (the same page, a guard that said no): the buttons work again
      this.busy.set(null);
      return;
    }
    this.busy.set(null);
    this.failure.set(result.message);
  }

  protected withProvider(provider: SignInProvider): void {
    this.busy.set(provider);
    // Refused once: the same account would come back at once, the provider shows its list
    this.session.signIn(provider, { access: this.token(), choose: this.denied() });
  }
}
