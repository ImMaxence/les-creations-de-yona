import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Toaster } from '../../../core/notifications/toaster';
import { CoverImage } from '../cover-image/cover-image';
import { GalleryPicker } from '../gallery-picker/gallery-picker';
import { PHOTO_ACCEPT, photoFileError } from './photo-file';
import { Icon } from '../icon/icon';


/**
 * Photo of a recipe or a category in the back-office: current picture, or a local preview of the
 * chosen file, then three ways to change it: a new file, a photo already in the gallery, or none.
 * The parent does the API calls. A replaced or removed photo stays in the gallery. portrait: the
 * vertical photo offered to Pinterest, chosen among the vertical photos only.
 */
@Component({
  selector: 'yona-image-upload',
  imports: [Icon, CoverImage, GalleryPicker],
  template: `
    <div class="preview">
      @if (previewUrl(); as url) {
        <img [src]="url" alt="" />
      } @else {
        <yona-cover-image [imageId]="imageId()" sizes="20rem" />
      }
      @if (progress() !== null) {
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
              <div class="progress__bar" [style.transform]="'scaleX(' + progress() + ')'"></div>
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
      <button type="button" class="pick" [disabled]="busy()" (click)="file.click()">
        <svg yonaIcon="image-up" [size]="18"></svg>
        {{ hasPhoto() ? 'Nouvelle photo' : 'Ajouter une photo' }}
      </button>
      <button type="button" class="pick" [disabled]="busy()" (click)="picker.open()">
        <svg yonaIcon="images" [size]="18"></svg>
        Choisir dans la galerie
      </button>
      @if (hasPhoto()) {
        <button type="button" class="pick pick--quiet" [disabled]="busy()" (click)="removed.emit()">
          <svg yonaIcon="image-off" [size]="18"></svg>
          Retirer
        </button>
      }
    </div>
    <p class="field__hint">
      @if (portrait()) {
        JPEG ou PNG, 10 Mo maximum, format vertical : 1000 × 1333 px minimum, 1000 × 1500 px (2:3) conseillé.
      } @else {
        JPEG ou PNG, 10 Mo maximum, format paysage (1200 × 800 px minimum).
      }
    </p>
    <yona-gallery-picker #picker [portrait]="portrait()" (chosen)="galleryImageChosen.emit($event)" />
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
  readonly fileChosen = output<File>();
  readonly galleryImageChosen = output<string>();
  /** "Retirer": back to the default visual. */
  readonly removed = output<void>();

  protected readonly accept = PHOTO_ACCEPT;
  protected readonly progressPercent = computed(() => Math.round((this.progress() ?? 0) * 100));
  /** Once sent, the server still makes its 800 and 1600 px versions. */
  protected readonly progressLabel = computed(() =>
    this.progressPercent() < 100 ? `Envoi de la photo… ${this.progressPercent()} %` : 'Préparation de la photo…',
  );
  private readonly toaster = inject(Toaster);
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
    } else {
      this.fileChosen.emit(file);
    }
  }
}
