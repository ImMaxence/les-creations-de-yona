import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { LucideImageUp, LucideLoaderCircle } from '@lucide/angular';
import { Toaster } from '../../../core/notifications/toaster';
import { CoverImage } from '../cover-image/cover-image';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
/** Same limit as the API (10 MB): refused before sending rather than after a long upload. */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Photo of a recipe or a category in the back-office: current picture, or a local preview of the
 * chosen file, and a button to pick another one. The parent does the upload.
 */
@Component({
  selector: 'yona-image-upload',
  imports: [CoverImage, LucideImageUp, LucideLoaderCircle],
  template: `
    <div class="preview">
      @if (previewUrl(); as url) {
        <img [src]="url" alt="" />
      } @else {
        <yona-cover-image [imageId]="imageId()" sizes="20rem" />
      }
      @if (busy()) {
        <div class="preview__busy" aria-live="polite">
          <svg lucideLoaderCircle class="spin" [size]="28"></svg>
          <span class="visually-hidden">Envoi de la photo…</span>
        </div>
      }
    </div>
    <!-- Hidden from assistive technologies: the button below is the way to reach it -->
    <input #file type="file" class="visually-hidden" tabindex="-1" aria-hidden="true" [accept]="accept" (change)="onFileChosen($event)" />
    <button type="button" class="pick" [disabled]="busy()" (click)="file.click()">
      <svg lucideImageUp [size]="18"></svg>
      {{ imageId() || previewUrl() ? 'Changer la photo' : 'Ajouter une photo' }}
    </button>
    <p class="field__hint">JPEG ou PNG, 10 Mo maximum, format paysage (1200 × 800 px minimum).</p>
  `,
  styleUrl: './image-upload.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUpload {
  readonly imageId = input<string | null | undefined>();
  /** Local preview, before the file is sent (new recipe). */
  readonly previewUrl = input<string | null>(null);
  readonly busy = input(false);
  readonly fileChosen = output<File>();

  protected readonly accept = ACCEPTED_TYPES.join(',');
  private readonly toaster = inject(Toaster);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  protected onFileChosen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    // Reset, so that choosing the same file again still triggers a change
    this.fileInput().nativeElement.value = '';
    if (!file) {
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.toaster.error('Choisissez une photo au format JPEG ou PNG.');
    } else if (file.size > MAX_SIZE_BYTES) {
      this.toaster.error('Cette photo dépasse 10 Mo.');
    } else {
      this.fileChosen.emit(file);
    }
  }
}
