import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { replaceImage } from '../../../core/api/generated/fn/admin-images/replace-image';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Toaster } from '../../../core/notifications/toaster';
import { CoverImage } from '../cover-image/cover-image';
import { GalleryPicker } from '../gallery-picker/gallery-picker';
import { PhotoEditor } from '../photo-editor/photo-editor';
import { PHOTO_ACCEPT, photoFileError } from './photo-file';
import { Icon } from '../icon/icon';


/**
 * Photo of a recipe or a category in the back-office: current picture, or a local preview of the
 * chosen file, then the ways to change it: a new file (prepared first in the photo editor: crop,
 * turn, filters), a photo already in the gallery, none, or "Retoucher" the current one. The parent
 * does the API calls, but for a retouch: the photo is replaced wherever it is shown, and the parent
 * only learns its new id. A replaced or removed photo stays in the gallery. portrait: the vertical
 * photo offered to Pinterest, chosen among the vertical photos only.
 */
@Component({
  selector: 'yona-image-upload',
  imports: [Icon, CoverImage, GalleryPicker, PhotoEditor],
  template: `
    <div class="preview">
      @if (previewUrl(); as url) {
        <img [src]="url" alt="" />
      } @else {
        <yona-cover-image [imageId]="imageId()" sizes="20rem" />
      }
      @if (shownProgress() !== null) {
        <div class="preview__busy">
          <div class="progress">
            <span class="progress__label" aria-live="polite">{{ progressLabel() }}</span>
            <div
              class="progress__track"
              role="progressbar"
              aria-label="Envoi de la photo"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-valuenow]="progressPercent()"
              [class.is-processing]="progressPercent() === 100"
            >
              <div class="progress__bar" [style.transform]="'scaleX(' + shownProgress() + ')'"></div>
            </div>
          </div>
        </div>
      } @else if (busy()) {
        <div class="preview__busy" aria-live="polite">
          <svg yonaIcon="loader-circle" class="spin" [size]="28"></svg>
          <span class="visually-hidden">Enregistrement de la photo…</span>
        </div>
      }
    </div>
    <!-- Hidden from assistive technologies: the button below is the way to reach it -->
    <input #file type="file" class="visually-hidden" tabindex="-1" aria-hidden="true" [accept]="accept" (change)="onFileChosen($event)" />
    <div class="actions">
      <button type="button" class="pick" [disabled]="working()" (click)="file.click()">
        <svg yonaIcon="image-up" [size]="18"></svg>
        {{ hasPhoto() ? 'Nouvelle photo' : 'Ajouter une photo' }}
      </button>
      <button type="button" class="pick" [disabled]="working()" (click)="picker.open()">
        <svg yonaIcon="images" [size]="18"></svg>
        Choisir dans la galerie
      </button>
      @if (imageId() && !previewUrl()) {
        <button type="button" class="pick" [disabled]="working()" (click)="retouchCurrent()">
          <svg yonaIcon="crop" [size]="18"></svg>
          Retoucher
        </button>
      }
      @if (hasPhoto()) {
        <button type="button" class="pick pick--quiet" [disabled]="working()" (click)="removed.emit()">
          <svg yonaIcon="image-off" [size]="18"></svg>
          Retirer
        </button>
      }
    </div>
    <p class="field__hint">
      @if (portrait()) {
        JPEG ou PNG, 10 Mo maximum, format vertical : 1000 × 1333 px minimum, 1000 × 1500 px (2:3) conseillé. Recadrage,
        rotation et filtres avant l'envoi
      } @else {
        JPEG ou PNG, 10 Mo maximum, format paysage (1200 × 800 px minimum). Recadrage, rotation et filtres avant l'envoi
      }
    </p>
    <yona-gallery-picker #picker [portrait]="portrait()" (chosen)="galleryImageChosen.emit($event)" />
    <yona-photo-editor
      [source]="editorSource()"
      [portrait]="portrait()"
      [retouch]="retouching()"
      [(open)]="editorOpen"
      (edited)="onEdited($event)"
    />
  `,
  styleUrl: './image-upload.scss',
  host: { '[class.is-portrait]': 'portrait()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUpload {
  readonly imageId = input<string | null | undefined>();
  /** Local preview, before the file is sent (new recipe). */
  readonly previewUrl = input<string | null>(null);
  readonly busy = input(false);
  /** Share of the new photo sent, from 0 to 1, while it uploads; null otherwise. */
  readonly progress = input<number | null>(null);
  readonly portrait = input(false, { transform: booleanAttribute });
  /** A new photo, prepared in the editor. */
  readonly fileChosen = output<File>();
  readonly galleryImageChosen = output<string>();
  /** "Retirer": back to the default visual. */
  readonly removed = output<void>();
  /** "Retoucher" saved: the id of the retouched photo, now shown wherever the previous one was. */
  readonly retouched = output<string>();

  protected readonly accept = PHOTO_ACCEPT;
  protected readonly editorOpen = signal(false);
  protected readonly editorSource = signal<File | string | null>(null);
  /** The editor shows the current photo (true), or a file just chosen. */
  protected readonly retouching = signal(false);
  /** Share of the retouched photo sent, from 0 to 1; null otherwise. */
  private readonly retouchProgress = signal<number | null>(null);
  protected readonly shownProgress = computed(() => this.progress() ?? this.retouchProgress());
  protected readonly working = computed(() => this.busy() || this.retouchProgress() !== null);
  protected readonly progressPercent = computed(() => Math.round((this.shownProgress() ?? 0) * 100));
  /** Once sent, the server still makes its 800 and 1600 px versions. */
  protected readonly progressLabel = computed(() =>
    this.progressPercent() < 100 ? `Envoi de la photo… ${this.progressPercent()} %` : 'Préparation de la photo…',
  );
  private readonly toaster = inject(Toaster);
  private readonly imageUploads = inject(ImageUploads);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  protected hasPhoto(): boolean {
    return !!(this.imageId() || this.previewUrl());
  }

  protected onFileChosen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    // Reset, so that choosing the same file again still triggers a change
    this.fileInput().nativeElement.value = '';
    if (!file) {
      return;
    }
    const error = photoFileError(file);
    if (error) {
      this.toaster.error(error);
      return;
    }
    this.retouching.set(false);
    this.editorSource.set(file);
    this.editorOpen.set(true);
  }

  /** The photo shown, from its largest file on the site. */
  protected retouchCurrent(): void {
    this.retouching.set(true);
    this.editorSource.set(`/api/images/${this.imageId()}/1600.webp`);
    this.editorOpen.set(true);
  }

  protected async onEdited(file: File): Promise<void> {
    const imageId = this.imageId();
    if (!this.retouching() || !imageId) {
      this.fileChosen.emit(file);
      return;
    }
    this.retouchProgress.set(0);
    const upload = await attempt(
      this.imageUploads.send<GalleryImage>(replaceImage.PATH.replace('{id}', imageId), file, (sent) =>
        this.retouchProgress.set(sent),
      ),
    );
    this.retouchProgress.set(null);
    if (upload.ok) {
      this.toaster.success('Photo retouchée, partout où elle est montrée');
      this.retouched.emit(upload.value.id);
    }
  }
}
