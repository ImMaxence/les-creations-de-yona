import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { uploadImage } from '../../../core/api/generated/fn/admin-images/upload-image';
import { createCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/create-cap-entry';
import { deleteCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/delete-cap-entry';
import { listAdminCapEntries } from '../../../core/api/generated/fn/admin-mon-cap/list-admin-cap-entries';
import { updateCapEntry } from '../../../core/api/generated/fn/admin-mon-cap/update-cap-entry';
import { CapEntryResponse } from '../../../core/api/generated/models/cap-entry-response';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { CAP_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';

const MAX_BODY_LENGTH = 10000;

/** Today in Paris, as the date field wants it. */
function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/** "Mon CAP": the dated steps of the diploma, shown on the site as a timeline. */
@Component({
  selector: 'yona-admin-cap',
  imports: [Button, Icon, ImageUpload, ParisDatePipe, RouterLink],
  template: `
    <section class="admin-section" aria-labelledby="cap-title">
      <div class="admin-section__head">
        <h2 id="cap-title">Mon CAP</h2>
        <a yonaButton variant="ghost" target="_blank" [routerLink]="capPath"><svg yonaIcon="external-link"></svg>Voir sur le site</a>
      </div>
      <p class="field__hint">Les étapes du CAP, affichées sur le site du plus récent au plus ancien</p>

      <form class="admin-panel" (submit)="save($event)">
        <h3>{{ editing() ? 'Modifier « ' + editing()!.title + ' »' : 'Ajouter une étape' }}</h3>
        <div class="field">
          <label class="field__label" for="cap-title-input">Titre</label>
          <input id="cap-title-input" class="input" maxlength="150" placeholder="Inscription au CAP Pâtisserie" [value]="title()" (input)="title.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="cap-date">Date</label>
          <input id="cap-date" class="input" type="date" [value]="date()" (input)="date.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="cap-body">Texte (facultatif)</label>
          <textarea id="cap-body" class="input" rows="6" [maxLength]="maxBodyLength" [value]="body()" (input)="body.set($any($event.target).value)"></textarea>
          <span class="field__hint">Markdown accepté. {{ body().length }} / {{ maxBodyLength }} caractères</span>
        </div>
        <div class="field">
          <span class="field__label">Photo (facultative)</span>
          <yona-image-upload
            [imageId]="imageId()"
            [aiSuggestion]="title()"
            [progress]="uploadProgress()"
            (fileChosen)="upload($event)"
            (galleryImageChosen)="imageId.set($event)"
            (removed)="imageId.set(null)"
            (retouched)="imageId.set($event)"
          />
        </div>
        <label class="checkbox-field">
          <input type="checkbox" [checked]="published()" (change)="published.set($any($event.target).checked)" />
          Publiée sur le site
        </label>
        <div class="admin-toolbar">
          <button yonaButton type="submit" [disabled]="saving()"><svg yonaIcon="save"></svg>{{ editing() ? 'Enregistrer' : 'Ajouter' }}</button>
          @if (editing()) {
            <button yonaButton variant="ghost" type="button" (click)="cancel()">Annuler</button>
          }
        </div>
      </form>

      @if (entries.value(); as list) {
        @if (list.length) {
          <ul role="list" class="admin-list">
            @for (entry of list; track entry.id) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <span class="admin-row__title">{{ entry.title }}</span>
                  <span class="admin-row__meta">
                    {{ entry.happenedOn | parisDate }}
                    @if (!entry.published) {
                      <span class="badge badge--draft">Brouillon</span>
                    }
                  </span>
                </span>
                <div class="admin-row__actions">
                  <button type="button" class="icon-button" [attr.aria-label]="'Modifier ' + entry.title" (click)="edit(entry)"><svg yonaIcon="pencil" [size]="18"></svg></button>
                  <button type="button" class="icon-button icon-button--danger" [attr.aria-label]="'Supprimer ' + entry.title" (click)="remove(entry)"><svg yonaIcon="trash" [size]="18"></svg></button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="admin-empty">Aucune étape pour le moment</p>
        }
      } @else if (entries.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      }
    </section>
  `,
  styles: `
    h3 {
      font-size: var(--text-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminCap {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly capPath = CAP_PATH;
  protected readonly maxBodyLength = MAX_BODY_LENGTH;
  protected readonly entries = resource({ loader: () => this.api.invoke(listAdminCapEntries) });

  /** The step being changed; null while adding a new one. */
  protected readonly editing = signal<CapEntryResponse | null>(null);
  protected readonly title = signal('');
  protected readonly date = signal(today());
  protected readonly body = signal('');
  protected readonly imageId = signal<string | null>(null);
  protected readonly published = signal(true);
  protected readonly saving = signal(false);
  /** Share of a new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);

  /** A new photo goes to the gallery, and the step shows it. */
  protected async upload(file: File): Promise<void> {
    this.uploadProgress.set(0);
    const sent = await attempt(this.imageUploads.send<GalleryImage>(uploadImage.PATH, file, (share) => this.uploadProgress.set(share), 'POST'));
    this.uploadProgress.set(null);
    if (sent.ok) {
      this.imageId.set(sent.value.id);
    }
  }

  protected edit(entry: CapEntryResponse): void {
    this.editing.set(entry);
    this.title.set(entry.title);
    this.date.set(entry.happenedOn);
    this.body.set(entry.body ?? '');
    this.imageId.set(entry.imageId ?? null);
    this.published.set(entry.published);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.title.set('');
    this.date.set(today());
    this.body.set('');
    this.imageId.set(null);
    this.published.set(true);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.title().trim() || !this.date()) {
      this.toaster.error('Donnez un titre et une date à cette étape');
      return;
    }
    const body = {
      title: this.title().trim(),
      body: this.body().trim() || undefined,
      happenedOn: this.date(),
      imageId: this.imageId() ?? undefined,
      published: this.published(),
    };
    const editing = this.editing();
    this.saving.set(true);
    const saved = await attempt(editing ? this.api.invoke(updateCapEntry, { id: editing.id, body }) : this.api.invoke(createCapEntry, { body }));
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(editing ? 'Étape enregistrée' : 'Étape ajoutée');
      this.cancel();
      this.reload();
    }
  }

  protected async remove(entry: CapEntryResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Mettre cette étape à la corbeille ?',
      message: `« ${entry.title} » disparaît du site et reste 30 jours dans la corbeille, d'où elle peut être restaurée`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteCapEntry, { id: entry.id }))).ok) {
      this.toaster.success('Étape mise à la corbeille');
      if (this.editing()?.id === entry.id) {
        this.cancel();
      }
      this.reload();
    }
  }

  /** The list, and the site's navigation ("Mon CAP" shows once a step is published). */
  private reload(): void {
    this.entries.reload();
    void this.siteData.load();
  }
}
