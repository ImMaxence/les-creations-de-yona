import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteMyPasskey } from '../../../core/api/generated/fn/admin-account/delete-my-passkey';
import { getMyAccount } from '../../../core/api/generated/fn/admin-account/get-my-account';
import { removeMyPhoto } from '../../../core/api/generated/fn/admin-account/remove-my-photo';
import { renameMyAccount } from '../../../core/api/generated/fn/admin-account/rename-my-account';
import { renameMyPasskey } from '../../../core/api/generated/fn/admin-account/rename-my-passkey';
import { unlinkMyIdentity } from '../../../core/api/generated/fn/admin-account/unlink-my-identity';
import { LinkedIdentity } from '../../../core/api/generated/models/linked-identity';
import { MyAccount } from '../../../core/api/generated/models/my-account';
import { PasskeyResponse } from '../../../core/api/generated/models/passkey-response';
import { ImageUploads } from '../../../core/api/image-uploads';
import { AdminSession } from '../../../core/auth/admin-session';
import { PasskeyClient } from '../../../core/auth/passkey-client';
import { passkeysSupported } from '../../../core/auth/passkeys';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { parisDay } from '../../../shared/format/paris-time';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminAvatar } from '../layout/admin-avatar/admin-avatar';
import { ProviderLogo } from '../login/provider-logo';

type Provider = LinkedIdentity['provider'];

const PROVIDER_NAMES: Record<Provider, string> = { GOOGLE: 'Google', MICROSOFT: 'Microsoft' };

/** What went wrong on the way to Google or Microsoft, from the end of the address (AccountSignIn.Refusal). */
const LINK_ERRORS: Record<string, string> = {
  'deja-pris': 'Ce compte est déjà relié à un autre admin du site',
  annule: "La liaison n'a pas abouti. Réessayez",
  desactive: 'Votre compte est désactivé',
};

/**
 * "Mon compte": the name and the photo the others see, and the ways in, as many as wanted. A passkey
 * needs no one else (neither Google nor Microsoft): two of them, on the phone and the computer, are
 * the advice. The last way in of an account cannot be removed (the API refuses it too).
 */
@Component({
  selector: 'yona-admin-account',
  imports: [AdminAvatar, Button, Icon, ProviderLogo],
  templateUrl: './admin-account.html',
  styleUrl: './admin-account.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminAccount implements OnInit {
  /** Back from Google or Microsoft: ?lie=google, ?erreur=deja-pris. Arrived with a link: ?bienvenue, ?recupere. */
  readonly lie = input<string>();
  readonly erreur = input<string>();
  readonly bienvenue = input<string>();
  readonly recupere = input<string>();

  private readonly api = inject(Api);
  private readonly session = inject(AdminSession);
  private readonly passkeys = inject(PasskeyClient);
  private readonly uploads = inject(ImageUploads);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(Confirm);
  private readonly router = inject(Router);

  protected readonly passkeysSupported = passkeysSupported();
  protected readonly providerNames = PROVIDER_NAMES;
  protected readonly day = parisDay;

  private readonly loaded = resource({ loader: () => this.api.invoke(getMyAccount) });
  /** As the API last answered: after each change, its answer replaces it. */
  protected readonly account = linkedSignal<MyAccount | undefined>(() => this.loaded.value());
  protected readonly name = linkedSignal(() => this.account()?.name ?? '');
  protected readonly nameChanged = computed(() => this.name().trim() !== (this.account()?.name ?? '') && this.name().trim().length > 0);

  /** The welcome of a link just used, until the admin closes it. */
  protected readonly arrival = signal<'welcome' | 'recovered' | null>(null);
  protected readonly busy = signal(false);
  protected readonly photoProgress = signal<number | null>(null);
  protected readonly photoPercent = computed(() => Math.round((this.photoProgress() ?? 0) * 100));
  protected readonly editing = signal<string | null>(null);
  protected readonly label = signal('');

  protected readonly methodCount = computed(() => {
    const account = this.account();
    return account ? account.identities.length + account.passkeys.length : 0;
  });
  /** Google always; Microsoft when the API offers it, or when it is already linked. */
  protected readonly providers = computed<Provider[]>(() => {
    const account = this.account();
    if (!account) {
      return [];
    }
    const linked = account.identities.map((identity) => identity.provider);
    return (['GOOGLE', 'MICROSOFT'] as Provider[]).filter(
      (provider) => provider === 'GOOGLE' || account.methods.microsoft || linked.includes(provider),
    );
  });

  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  ngOnInit(): void {
    this.readArrival();
  }

  protected identity(provider: Provider): LinkedIdentity | undefined {
    return this.account()?.identities.find((identity) => identity.provider === provider);
  }

  // Profile

  protected async saveName(): Promise<void> {
    await this.change(() => this.api.invoke(renameMyAccount, { body: { name: this.name().trim() } }), 'Nom enregistré');
  }

  protected choosePhoto(): void {
    this.photoInput()?.nativeElement.click();
  }

  protected async uploadPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.photoProgress.set(0);
    try {
      this.account.set(await this.uploads.send<MyAccount>('/api/admin/account/photo', file, (sent) => this.photoProgress.set(sent)));
      await this.session.load();
      this.toaster.success('Photo enregistrée');
    } catch {
      // Already shown by ImageUploads
    } finally {
      this.photoProgress.set(null);
    }
  }

  protected async removePhoto(): Promise<void> {
    await this.change(() => this.api.invoke(removeMyPhoto), 'Photo retirée');
  }

  // Ways in

  protected async addPasskey(): Promise<void> {
    this.busy.set(true);
    const result = await this.passkeys.create<MyAccount>('/api/admin/account/passkeys');
    this.busy.set(false);
    if (result.ok) {
      this.account.set(result.value);
      this.arrival.set(null);
      this.toaster.success('Passkey ajoutée : elle vous connecte désormais sur cet appareil');
    } else if (result.message) {
      this.toaster.error(result.message);
    }
  }

  protected startRename(passkey: PasskeyResponse): void {
    this.editing.set(passkey.id);
    this.label.set(passkey.label);
  }

  protected async saveLabel(passkey: PasskeyResponse): Promise<void> {
    const label = this.label().trim();
    if (!label || label === passkey.label) {
      this.editing.set(null);
      return;
    }
    if (await this.change(() => this.api.invoke(renameMyPasskey, { id: passkey.id, body: { label } }), 'Passkey renommée')) {
      this.editing.set(null);
    }
  }

  protected async deletePasskey(passkey: PasskeyResponse): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Supprimer cette passkey ?',
      message: `« ${passkey.label} » ne vous connectera plus. Elle reste sur l'appareil jusqu'à ce que vous l'y supprimiez aussi (réglages des mots de passe)`,
      confirmLabel: 'Supprimer',
    });
    if (ok) {
      await this.change(() => this.api.invoke(deleteMyPasskey, { id: passkey.id }), 'Passkey supprimée');
    }
  }

  /** Full page navigation to Google or Microsoft, back here with ?lie= or ?erreur=. */
  protected link(provider: Provider): void {
    this.busy.set(true);
    this.session.signIn(provider === 'GOOGLE' ? 'google' : 'microsoft', { link: true });
  }

  protected async unlink(provider: Provider): Promise<void> {
    const name = PROVIDER_NAMES[provider];
    const ok = await this.confirm.ask({
      title: `Délier votre compte ${name} ?`,
      message: `Il ne vous connectera plus au back-office. Vous pourrez le relier de nouveau ici`,
      confirmLabel: 'Délier',
    });
    if (ok) {
      await this.change(() => this.api.invoke(unlinkMyIdentity, { provider }), `Compte ${name} délié`);
    }
  }

  /** A change of the account: the API's answer shown, the menu's name and photo refreshed. */
  private async change(call: () => Promise<MyAccount>, done: string): Promise<boolean> {
    this.busy.set(true);
    const result = await attempt(call());
    this.busy.set(false);
    if (result.ok) {
      this.account.set(result.value);
      this.toaster.success(done);
      void this.session.load();
    }
    return result.ok;
  }

  /** What the address says, said once: then the address is cleaned (a reload says nothing again). */
  private readArrival(): void {
    const linked = this.lie();
    const error = this.erreur();
    if (linked) {
      this.toaster.success(`Compte ${linked === 'microsoft' ? 'Microsoft' : 'Google'} relié : il vous connecte désormais`);
    }
    if (error !== undefined) {
      this.toaster.error(LINK_ERRORS[error] ?? LINK_ERRORS['annule']);
    }
    if (this.bienvenue() !== undefined) {
      this.arrival.set('welcome');
    } else if (this.recupere() !== undefined) {
      this.arrival.set('recovered');
    }
    if (linked || error !== undefined || this.arrival()) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }
}
