import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { createMessageGroup } from '../../../core/api/generated/fn/admin-messages/create-message-group';
import { deleteMessageGroup } from '../../../core/api/generated/fn/admin-messages/delete-message-group';
import { leaveMessageGroup } from '../../../core/api/generated/fn/admin-messages/leave-message-group';
import { removeMessageGroupPhoto } from '../../../core/api/generated/fn/admin-messages/remove-message-group-photo';
import { setMessageGroupPhoto } from '../../../core/api/generated/fn/admin-messages/set-message-group-photo';
import { updateMessageGroup } from '../../../core/api/generated/fn/admin-messages/update-message-group';
import { GroupMember } from '../../../core/api/generated/models/group-member';
import { MessageGroup } from '../../../core/api/generated/models/message-group';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminAvatar } from '../layout/admin-avatar/admin-avatar';
import { messagePhoto, sendablePhoto } from './message-photos';

const MAX_NAME = 60;

/**
 * "Nouveau groupe" and "Modifier le groupe": its name, its photo and its members, the same for every
 * member (none is the group's own admin). The group of all the admins keeps its members: all of them.
 * A group is left from here, or deleted for everyone, its messages with it.
 */
@Component({
  selector: 'yona-group-dialog',
  imports: [AdminAvatar, Button, Dialog, Icon],
  template: `
    <yona-dialog [title]="group() ? 'Modifier le groupe' : 'Nouveau groupe'" size="md" [(open)]="open">
      <form class="group-form" (submit)="$event.preventDefault(); save()">
        <div class="group-form__photo">
          <yona-admin-avatar class="group-form__avatar" [name]="name() || '?'" [picture]="shownPhoto()" />
          <div class="group-form__photo-actions">
            <input #photo type="file" accept="image/*" hidden (change)="onPhoto($event)" />
            <button yonaButton variant="secondary" type="button" (click)="photo.click()">
              <svg yonaIcon="camera"></svg>{{ shownPhoto() ? 'Changer la photo' : 'Ajouter une photo' }}
            </button>
            @if (shownPhoto()) {
              <button type="button" class="link-button" (click)="dropPhoto()">Retirer la photo</button>
            }
          </div>
        </div>

        <div class="field">
          <label class="field__label" for="group-name">Nom du groupe</label>
          <input id="group-name" class="input" required placeholder="Boutique de Noël" [maxLength]="maxName" [value]="name()" (input)="name.set($any($event.target).value)" />
        </div>

        @if (group()?.everyone) {
          <p class="field__hint">Tous les admins du back-office font partie de ce groupe : chacun peut changer son nom et sa photo</p>
        } @else {
          <fieldset class="field members">
            <legend class="field__label">Membres</legend>
            <ul role="list" class="members__list">
              @for (admin of admins(); track admin.email) {
                <li>
                  <label class="member-choice">
                    <input type="checkbox" [checked]="chosen().has(admin.email)" [disabled]="admin.email === me()" (change)="toggle(admin.email)" />
                    <yona-admin-avatar [name]="admin.name || admin.email" [picture]="admin.picture" />
                    <span class="member-choice__name">{{ admin.name || admin.email }}{{ admin.email === me() ? ' (vous)' : '' }}</span>
                  </label>
                </li>
              }
            </ul>
            <p class="field__hint">Chaque membre peut renommer le groupe, changer sa photo et ses membres. Seuls les membres lisent ses messages</p>
          </fieldset>
        }

        <div class="group-form__actions">
          @if (group(); as current) {
            @if (!current.everyone) {
              <button yonaButton variant="ghost" type="button" [disabled]="busy()" (click)="leave(current)"><svg yonaIcon="log-out"></svg>Quitter</button>
              <button yonaButton variant="danger" type="button" [disabled]="busy()" (click)="remove(current)"><svg yonaIcon="trash"></svg>Supprimer</button>
            }
          }
          <button yonaButton type="submit" class="group-form__save" [disabled]="busy() || !name().trim()">
            {{ busy() ? 'Enregistrement…' : group() ? 'Enregistrer' : 'Créer le groupe' }}
          </button>
        </div>
      </form>
    </yona-dialog>
  `,
  styles: `
    @use 'mixins' as m;

    .group-form {
      display: grid;
      gap: var(--space-5);
    }

    .group-form__photo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
    }

    .group-form__avatar {
      width: 4.5rem;
      height: 4.5rem;
      font-size: var(--text-2xl);
    }

    .group-form__photo-actions {
      display: grid;
      justify-items: start;
      gap: var(--space-1);
    }

    .members {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .members__list {
      display: grid;
      gap: var(--space-1);
    }

    .member-choice {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 2.75rem;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      font-weight: 600;
      cursor: pointer;

      @include m.hover {
        background-color: var(--color-surface);
      }

      input {
        width: 1.25rem;
        height: 1.25rem;
        accent-color: var(--color-accent);
      }

      yona-admin-avatar {
        width: 2rem;
        height: 2rem;
        font-size: var(--text-sm);
      }
    }

    .member-choice__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .group-form__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .group-form__save {
      margin-left: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDialog {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  readonly open = model(false);
  /** The group changed; null for a new one. */
  readonly group = input<MessageGroup | null>(null);
  /** Every admin, to choose the members among. */
  readonly admins = input<GroupMember[]>([]);
  /** The admin signed in, in lower case: always a member. */
  readonly me = input('');
  readonly saved = output<MessageGroup>();
  /** Left or deleted: the conversation goes. */
  readonly gone = output<number>();

  protected readonly maxName = MAX_NAME;
  protected readonly name = signal('');
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  private readonly photoFile = signal<File | null>(null);
  private readonly photoPreview = signal<string | null>(null);
  private readonly photoRemoved = signal(false);
  protected readonly busy = signal(false);
  protected readonly shownPhoto = computed(() => {
    const group = this.group();
    if (this.photoPreview()) {
      return this.photoPreview();
    }
    return group?.imageId && !this.photoRemoved() ? messagePhoto(group.imageId) : null;
  });

  constructor() {
    // Opened: the fields of the group, or empty with the admin signed in
    effect(() => {
      if (!this.open()) {
        return;
      }
      untracked(() => {
        const group = this.group();
        this.name.set(group?.name ?? '');
        this.chosen.set(new Set([...(group?.members ?? []), this.me()]));
        this.resetPhoto();
      });
    });
    inject(DestroyRef).onDestroy(() => this.resetPhoto());
  }

  protected toggle(email: string): void {
    this.chosen.update((chosen) => {
      const next = new Set(chosen);
      if (!next.delete(email)) {
        next.add(email);
      }
      return next;
    });
  }

  protected async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0];
    input.value = '';
    if (!chosen) {
      return;
    }
    const file = await sendablePhoto(chosen);
    if (!file) {
      this.toaster.error('Cette photo ne peut pas être lue : choisissez une photo JPEG ou PNG');
      return;
    }
    this.resetPhoto();
    this.photoFile.set(file);
    this.photoPreview.set(URL.createObjectURL(file));
  }

  protected dropPhoto(): void {
    this.resetPhoto();
    this.photoRemoved.set(true);
  }

  private resetPhoto(): void {
    const preview = this.photoPreview();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.photoFile.set(null);
    this.photoPreview.set(null);
    this.photoRemoved.set(false);
  }

  protected async save(): Promise<void> {
    const name = this.name().trim();
    const current = this.group();
    if (!name || this.busy()) {
      return;
    }
    const others = [...this.chosen()].filter((email) => email !== this.me());
    if (!current?.everyone && !others.length) {
      this.toaster.error('Choisissez au moins un autre admin pour ce groupe');
      return;
    }
    this.busy.set(true);
    const body = { name, members: [...this.chosen()] };
    const written = await attempt(
      current ? this.api.invoke(updateMessageGroup, { id: current.id, body }) : this.api.invoke(createMessageGroup, { body }),
    );
    let group = written.ok ? written.value : null;
    if (group) {
      const file = this.photoFile();
      if (file) {
        const path = setMessageGroupPhoto.PATH.replace('{id}', String(group.id));
        const photo = await attempt(this.imageUploads.send<MessageGroup>(path, file, () => undefined, 'PUT'));
        group = photo.ok ? photo.value : group;
      } else if (this.photoRemoved() && group.imageId) {
        const removed = await attempt(this.api.invoke(removeMessageGroupPhoto, { id: group.id }));
        group = removed.ok ? removed.value : group;
      }
    }
    this.busy.set(false);
    if (group) {
      this.toaster.success(current ? 'Groupe enregistré' : `Groupe « ${group.name} » créé`);
      this.saved.emit(group);
      this.open.set(false);
    }
  }

  protected async leave(group: MessageGroup): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Quitter ce groupe ?',
      message: `Vous ne lirez plus les messages de « ${group.name} ». Un autre membre pourra vous y remettre`,
      confirmLabel: 'Quitter',
    });
    if (confirmed && (await this.run(() => this.api.invoke(leaveMessageGroup, { id: group.id })))) {
      this.toaster.success(`Vous avez quitté « ${group.name} »`);
      this.gone.emit(group.id);
    }
  }

  protected async remove(group: MessageGroup): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer ce groupe ?',
      message: `« ${group.name} » disparaît pour tous ses membres, avec ses messages et ses photos`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await this.run(() => this.api.invoke(deleteMessageGroup, { id: group.id })))) {
      this.toaster.success(`Groupe « ${group.name} » supprimé`);
      this.gone.emit(group.id);
    }
  }

  private async run(call: () => Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    const done = await attempt(call());
    this.busy.set(false);
    if (done.ok) {
      this.open.set(false);
    }
    return done.ok;
  }
}
