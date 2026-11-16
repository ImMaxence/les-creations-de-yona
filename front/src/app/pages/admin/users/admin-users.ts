import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { cancelAccessLink } from '../../../core/api/generated/fn/admin-accounts/cancel-access-link';
import { deleteAdminAccount } from '../../../core/api/generated/fn/admin-accounts/delete-admin-account';
import { inviteAdmin } from '../../../core/api/generated/fn/admin-accounts/invite-admin';
import { issueAccessLink } from '../../../core/api/generated/fn/admin-accounts/issue-access-link';
import { listAdminAccounts } from '../../../core/api/generated/fn/admin-accounts/list-admin-accounts';
import { setAdminAccountStatus } from '../../../core/api/generated/fn/admin-accounts/set-admin-account-status';
import { AdminUser } from '../../../core/api/generated/models/admin-user';
import { IssuedAccessLink } from '../../../core/api/generated/models/issued-access-link';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { parisDateTime, parisDay } from '../../../shared/format/paris-time';
import { remaining, tickingNow } from '../../../shared/format/remaining';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminAvatar } from '../layout/admin-avatar/admin-avatar';
import { ProviderLogo } from '../login/provider-logo';

const METHODS: Record<NonNullable<AdminUser['lastSignInMethod']>, string> = {
  GOOGLE: 'Google',
  MICROSOFT: 'Microsoft',
  PASSKEY: 'une passkey',
};

/** A link just made, shown once with the admin it is for: only its hash stays on the server. */
interface ShownLink {
  user: AdminUser;
  link: IssuedAccessLink;
}

/**
 * "Utilisateurs": the admins of the back-office. Inviting one makes their account and a link to
 * give them (SMS, WhatsApp…: the site sends no email); they choose their way in with it, then add
 * others in "Mon compte". An admin who lost their ways in gets a recovery link the same way. Nobody
 * disables nor deletes themselves: one admin always remains.
 */
@Component({
  selector: 'yona-admin-users',
  imports: [AdminAvatar, Button, Dialog, Icon, ProviderLogo],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminUsers {
  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);

  protected readonly day = parisDay;
  /** Every second: the time left of each link counts down. */
  private readonly now = tickingNow();
  protected readonly dateTime = parisDateTime;
  protected readonly methods = METHODS;
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  private readonly loaded = resource({ loader: () => this.api.invoke(listAdminAccounts) });
  protected readonly users = linkedSignal<AdminUser[]>(() => this.loaded.value() ?? []);
  protected readonly busy = signal<number | 'invite' | null>(null);

  protected readonly inviting = signal(false);
  protected readonly inviteEmail = signal('');
  protected readonly inviteName = signal('');
  protected readonly inviteValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.inviteEmail().trim()));

  protected readonly shown = signal<ShownLink | null>(null);
  protected readonly shownOpen = signal(false);
  protected readonly copied = signal(false);

  protected readonly shownTitle = computed(() => (this.shown()?.link.purpose === 'INVITATION' ? "Lien d'invitation" : 'Lien de récupération'));

  protected linkAction(user: AdminUser): string {
    return user.status === 'INVITED' ? "Nouveau lien d'invitation" : 'Lien de récupération';
  }

  protected nameOf(user: AdminUser): string {
    return user.name || user.email;
  }

  protected lastSignIn(user: AdminUser): string {
    if (!user.lastSignInAt) {
      return user.status === 'INVITED' ? 'Pas encore venu·e' : 'Jamais connecté·e';
    }
    const method = user.lastSignInMethod ? ` avec ${METHODS[user.lastSignInMethod]}` : '';
    return `Dernière connexion le ${parisDateTime(user.lastSignInAt)}${method}`;
  }

  /** No way in yet: an account of APP_ADMIN_EMAILS gets the Google account of its address at its first sign-in. */
  protected firstWayIn(user: AdminUser): string {
    return user.status === 'ACTIVE' && !user.lastSignInAt
      ? 'Entrera la première fois avec le compte Google de cette adresse'
      : "Aucun moyen de connexion pour l'instant";
  }

  protected linkLine(user: AdminUser): string | null {
    const link = user.link;
    if (!link) {
      return null;
    }
    const kind = link.purpose === 'INVITATION' ? "Lien d'invitation" : 'Lien de récupération';
    return this.linkExpired(user) ? `${kind} expiré` : `${kind} valable jusqu'au ${parisDateTime(link.expiresAt)}`;
  }

  /** Expired for the API, or since the page opened, as the countdown reached 0. */
  protected linkExpired(user: AdminUser): boolean {
    return !!user.link && (user.link.expired || this.timeLeft(user.link.expiresAt) === null);
  }

  /** "6 j 23 h 05 min", then with the seconds on the last day; null once expired. */
  protected timeLeft(expiresAt: string): string | null {
    return remaining(expiresAt, this.now());
  }

  // Inviting

  protected openInvite(): void {
    this.inviteEmail.set('');
    this.inviteName.set('');
    this.inviting.set(true);
  }

  protected async invite(): Promise<void> {
    if (!this.inviteValid()) {
      return;
    }
    this.busy.set('invite');
    const result = await attempt(
      this.api.invoke(inviteAdmin, { body: { email: this.inviteEmail().trim(), name: this.inviteName().trim() || undefined } }),
    );
    this.busy.set(null);
    if (result.ok) {
      this.inviting.set(false);
      this.users.update((users) => [...users, result.value.user]);
      this.show({ user: result.value.user, link: result.value.link });
    }
  }

  // A link to come in

  protected async issueLink(user: AdminUser): Promise<void> {
    if (user.link && !user.link.expired) {
      const ok = await this.confirm.ask({
        title: 'Faire un nouveau lien ?',
        message: `Le lien envoyé à ${this.nameOf(user)} ne servira plus : seul le nouveau le laissera entrer`,
        confirmLabel: 'Nouveau lien',
      });
      if (!ok) {
        return;
      }
    }
    this.busy.set(user.id);
    const result = await attempt(this.api.invoke(issueAccessLink, { id: user.id }));
    this.busy.set(null);
    if (result.ok) {
      const link = result.value;
      this.replace({ ...user, link: { purpose: link.purpose, createdAt: new Date().toISOString(), expiresAt: link.expiresAt, expired: false } });
      this.show({ user, link });
    }
  }

  /** The link waiting stops working at once: whoever holds it can no longer come in. */
  protected async revokeLink(user: AdminUser): Promise<boolean> {
    this.busy.set(user.id);
    const result = await attempt(this.api.invoke(cancelAccessLink, { id: user.id }));
    this.busy.set(null);
    if (result.ok) {
      const current = this.users().find((other) => other.id === user.id) ?? user;
      this.replace({ ...current, link: undefined });
      this.toaster.success(user.link?.expired ? 'Lien expiré retiré' : 'Lien révoqué : il ne laisse plus entrer personne');
    }
    return result.ok;
  }

  /** Right after making it: revoked, and the window closed. */
  protected async revokeShown(user: AdminUser): Promise<void> {
    if (await this.revokeLink({ ...user, link: undefined })) {
      this.shownOpen.set(false);
    }
  }

  protected async copy(): Promise<void> {
    const url = this.shown()?.link.url;
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      this.toaster.error('La copie a été refusée : sélectionnez le lien et copiez-le à la main');
    }
  }

  protected async share(): Promise<void> {
    const shown = this.shown();
    if (!shown) {
      return;
    }
    try {
      await navigator.share({ title: 'Back-office des créations de Yona', text: this.shareText(shown), url: shown.link.url });
    } catch {
      // Closed without sharing
    }
  }

  protected shareText(shown: ShownLink): string {
    return shown.link.purpose === 'INVITATION'
      ? 'Voici ton invitation au back-office des créations de Yona'
      : "Voici un lien pour retrouver l'accès au back-office des créations de Yona";
  }

  // Disabling, deleting

  protected async toggle(user: AdminUser): Promise<void> {
    const disabling = user.status !== 'DISABLED';
    if (disabling) {
      const ok = await this.confirm.ask({
        title: `Désactiver ${this.nameOf(user)} ?`,
        message:
          "Déconnecté·e tout de suite, sur tous ses appareils, et sans accès tant que le compte reste désactivé. Rien de ce qui a été écrit n'est perdu",
        confirmLabel: 'Désactiver',
      });
      if (!ok) {
        return;
      }
    }
    this.busy.set(user.id);
    const result = await attempt(this.api.invoke(setAdminAccountStatus, { id: user.id, body: { status: disabling ? 'DISABLED' : 'ACTIVE' } }));
    this.busy.set(null);
    if (result.ok) {
      this.replace(result.value);
      this.toaster.success(disabling ? 'Compte désactivé' : 'Compte réactivé');
    }
  }

  protected async remove(user: AdminUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Supprimer le compte de ${this.nameOf(user)} ?`,
      message:
        "Ses moyens de connexion sont oubliés. Ce qui a été écrit reste, sous son adresse. Pour seulement lui retirer l'accès, désactivez plutôt le compte",
      confirmLabel: 'Supprimer',
    });
    if (!ok) {
      return;
    }
    this.busy.set(user.id);
    const result = await attempt(this.api.invoke(deleteAdminAccount, { id: user.id }));
    this.busy.set(null);
    if (result.ok) {
      this.users.update((users) => users.filter((other) => other.id !== user.id));
      this.toaster.success('Compte supprimé');
    }
  }

  private show(shown: ShownLink): void {
    this.copied.set(false);
    this.shown.set(shown);
    this.shownOpen.set(true);
  }

  private replace(user: AdminUser): void {
    this.users.update((users) => users.map((other) => (other.id === user.id ? user : other)));
  }
}
