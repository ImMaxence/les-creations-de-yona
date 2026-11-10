import { ChangeDetectionStrategy, Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';

/** A photo shown big: its id on the API, and its caption if any. */
export interface ViewedPhoto {
  imageId: string;
  caption?: string | null;
  alt?: string;
}

/**
 * The photos of a page, one at a time on the whole screen: a native <dialog> (focus kept inside,
 * Escape closes it), arrows and keyboard to go from one to the next. open(index) shows one.
 */
@Component({
  selector: 'yona-photo-viewer',
  imports: [Icon],
  template: `
    <dialog #dialog class="viewer" aria-label="Photo en grand" (close)="index.set(null)" (click)="closeOnBackdrop($event)" (keydown)="onKey($event)">
      @if (current(); as photo) {
        <figure class="viewer__figure">
          <img class="viewer__image" [src]="'/api/images/' + photo.imageId + '/1600.webp'" [alt]="photo.alt || photo.caption || ''" />
          @if (photo.caption || photos().length > 1) {
            <figcaption class="viewer__caption">
              @if (photos().length > 1) {
                <span class="viewer__count">{{ (index() ?? 0) + 1 }} / {{ photos().length }}</span>
              }
              {{ photo.caption }}
            </figcaption>
          }
        </figure>
        @if (photos().length > 1) {
          <button type="button" class="viewer__nav viewer__nav--previous" aria-label="Photo précédente" (click)="step(-1)">
            <svg yonaIcon="chevron-left" [size]="28"></svg>
          </button>
          <button type="button" class="viewer__nav viewer__nav--next" aria-label="Photo suivante" (click)="step(1)">
            <svg yonaIcon="chevron-right" [size]="28"></svg>
          </button>
        }
      }
      <button type="button" class="viewer__close" aria-label="Fermer" (click)="close()"><svg yonaIcon="x" [size]="24"></svg></button>
    </dialog>
  `,
  styles: `
    .viewer {
      width: 100vw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--color-on-image);

      &::backdrop {
        background-color: rgb(10 6 4 / 92%);
      }
    }

    .viewer__figure {
      display: grid;
      place-content: center;
      gap: var(--space-3);
      height: 100%;
      padding: var(--space-7) var(--space-4);
      pointer-events: none;
    }

    .viewer__image {
      max-width: min(100%, 100rem);
      max-height: calc(100dvh - 9rem);
      margin-inline: auto;
      border-radius: var(--radius-md);
      object-fit: contain;
      pointer-events: auto;
    }

    .viewer__caption {
      max-width: 40rem;
      margin-inline: auto;
      font-size: var(--text-sm);
      text-align: center;
    }

    .viewer__count {
      margin-right: var(--space-2);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .viewer__close,
    .viewer__nav {
      position: fixed;
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background-color: rgb(255 255 255 / 12%);
      color: inherit;

      &:hover {
        background-color: rgb(255 255 255 / 22%);
      }
    }

    .viewer__close {
      top: var(--space-3);
      right: var(--space-3);
    }

    .viewer__nav {
      top: 50%;
      translate: 0 -50%;
    }

    .viewer__nav--previous {
      left: var(--space-3);
    }

    .viewer__nav--next {
      right: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoViewer {
  readonly photos = input<ViewedPhoto[]>([]);

  protected readonly index = signal<number | null>(null);
  protected readonly current = computed(() => {
    const index = this.index();
    return index === null ? null : (this.photos()[index] ?? null);
  });
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(index: number): void {
    if (!this.photos()[index]) {
      return;
    }
    this.index.set(index);
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  /** The photo with this id, among those of the page. */
  openPhoto(imageId: string): void {
    this.open(this.photos().findIndex((photo) => photo.imageId === imageId));
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected step(delta: number): void {
    const count = this.photos().length;
    this.index.update((index) => ((index ?? 0) + delta + count) % count);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      this.step(1);
    } else if (event.key === 'ArrowLeft') {
      this.step(-1);
    }
  }

  /** A tap beside the photo closes it, as the dark backdrop around. */
  protected closeOnBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target === this.dialog().nativeElement || target.classList.contains('viewer__figure')) {
      this.close();
    }
  }
}
