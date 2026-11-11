import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * What is coming, drawn in grey while it loads:
 * - rows: the rows of a back-office list (photo, title, details, actions);
 * - cards: recipe cards, as the grid of the site;
 * - tiles: square photos, as the gallery;
 * - figures: the figures at the top of a dashboard;
 * - form: an editor, its fields one under the other;
 * - recipe, list, article: a page of the site, while the next one loads.
 */
export type SkeletonKind = 'rows' | 'cards' | 'tiles' | 'figures' | 'form' | 'recipe' | 'list' | 'article';

/** Widths that vary from one line to the next, as real text does. */
const WIDTHS = ['92%', '78%', '85%', '64%', '88%', '70%'];

@Component({
  selector: 'yona-skeleton',
  template: `
    <span class="visually-hidden">Chargement…</span>
    @switch (kind()) {
      @case ('rows') {
        <ul role="list" class="rows" aria-hidden="true">
          @for (item of items(); track item) {
            <li class="row">
              <span class="bone row__thumb"></span>
              <span class="row__main">
                <span class="bone line line--title" [style.width]="width(item, 1)"></span>
                <span class="bone line line--small" [style.width]="width(item, 3)"></span>
              </span>
              <span class="bone row__action"></span>
              <span class="bone row__action"></span>
            </li>
          }
        </ul>
      }
      @case ('cards') {
        <ul role="list" class="cards" aria-hidden="true">
          @for (item of items(); track item) {
            <li class="card">
              <span class="bone card__image"></span>
              <span class="bone line line--small" style="width: 35%"></span>
              <span class="bone line line--title" [style.width]="width(item, 0)"></span>
              <span class="bone line line--small" [style.width]="width(item, 3)"></span>
            </li>
          }
        </ul>
      }
      @case ('tiles') {
        <ul role="list" class="tiles" aria-hidden="true">
          @for (item of items(); track item) {
            <li class="bone tile"></li>
          }
        </ul>
      }
      @case ('figures') {
        <div class="figures" aria-hidden="true">
          @for (item of items(); track item) {
            <div class="figure">
              <span class="bone line line--small" style="width: 55%"></span>
              <span class="bone figure__number"></span>
              <span class="bone line line--small" [style.width]="width(item, 1)"></span>
            </div>
          }
        </div>
      }
      @case ('form') {
        <div class="form" aria-hidden="true">
          @for (item of items(); track item) {
            <div class="field">
              <span class="bone line line--small" style="width: 8rem"></span>
              <span class="bone input" [class.input--tall]="item % 3 === 2"></span>
            </div>
          }
        </div>
      }
      @case ('recipe') {
        <div class="page" aria-hidden="true">
          <span class="bone hero"></span>
          <div class="page__body">
            <span class="bone line line--small" style="width: 30%"></span>
            <span class="bone line line--heading" style="width: 70%"></span>
            <span class="bone line" style="width: 90%"></span>
            <span class="bone line" style="width: 60%"></span>
            <div class="facts">
              @for (fact of [0, 1, 2, 3]; track fact) {
                <span class="bone fact"></span>
              }
            </div>
            @for (item of items(); track item) {
              <span class="bone line" [style.width]="width(item, 0)"></span>
            }
          </div>
        </div>
      }
      @case ('list') {
        <div class="page page--padded" aria-hidden="true">
          <span class="bone line line--heading" style="width: 45%"></span>
          <span class="bone line" style="width: 70%"></span>
          <ul role="list" class="cards">
            @for (item of items(); track item) {
              <li class="card">
                <span class="bone card__image"></span>
                <span class="bone line line--title" [style.width]="width(item, 0)"></span>
                <span class="bone line line--small" [style.width]="width(item, 3)"></span>
              </li>
            }
          </ul>
        </div>
      }
      @case ('article') {
        <div class="page page--padded page--narrow" aria-hidden="true">
          <span class="bone line line--small" style="width: 25%"></span>
          <span class="bone line line--heading" style="width: 80%"></span>
          <span class="bone line" style="width: 55%"></span>
          <span class="bone hero hero--inline"></span>
          @for (item of items(); track item) {
            <span class="bone line" [style.width]="width(item, 0)"></span>
          }
        </div>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }

    // Each shape breathes, together: opacity only, light on phones; still when motion is reduced
    .bone {
      display: block;
      border-radius: var(--radius-sm);
      background-color: color-mix(in srgb, var(--color-text) 9%, transparent);
      animation: breathe 1.4s var(--ease-in-out) infinite alternate;
    }

    @keyframes breathe {
      to {
        opacity: 0.45;
      }
    }

    .line {
      height: 0.85rem;
    }

    .line--small {
      height: 0.65rem;
    }

    .line--title {
      height: 1rem;
    }

    .line--heading {
      height: clamp(1.75rem, 4vw, 2.75rem);
      border-radius: var(--radius-md);
    }

    // Back-office lists
    .rows {
      display: grid;
      gap: var(--space-2);
    }

    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background-color: var(--color-bg);
      box-shadow: 0 0 0 1px var(--color-line);
    }

    .row__thumb {
      flex: none;
      width: 4rem;
      aspect-ratio: 4 / 3;
    }

    .row__main {
      display: grid;
      flex: 1;
      gap: var(--space-2);
    }

    .row__action {
      flex: none;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;

      @include m.below(sm) {
        display: none;
      }
    }

    // Cards and photos
    // The grid of the recipe cards (.recipe-grid): 1, 2 then 3 columns
    .cards {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);

      @include m.from(sm) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-5);
      }

      @include m.from(lg) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-6);
      }
    }

    .card {
      display: grid;
      gap: var(--space-2);
      align-content: start;
    }

    .card__image {
      aspect-ratio: 4 / 3;
      margin-bottom: var(--space-2);
      border-radius: var(--radius-lg);
    }

    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
      gap: var(--space-3);
    }

    .tile {
      aspect-ratio: 1;
      border-radius: var(--radius-md);
    }

    // Dashboards and editors
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
      gap: var(--space-3);
    }

    .figure {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
    }

    .figure__number {
      width: 40%;
      height: 2rem;
    }

    .form {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
    }

    .field {
      display: grid;
      gap: var(--space-2);
    }

    .input {
      height: 2.75rem;
      border-radius: var(--radius-md);
    }

    .input--tall {
      height: 7rem;
    }

    // Pages of the site
    .page {
      display: grid;
      gap: var(--space-4);
    }

    // As .container
    .page--padded {
      width: min(100% - 2 * var(--container-padding), var(--container-width));
      margin-inline: auto;
      padding-block: var(--space-8);
    }

    .page--narrow {
      width: min(100% - 2 * var(--container-padding), 46rem);
    }

    .page__body {
      display: grid;
      gap: var(--space-4);
      width: 100%;
      width: min(100% - 2 * var(--container-padding), 46rem);
      margin-inline: auto;
      padding-block: var(--space-6);
    }

    .hero {
      height: clamp(16rem, 45vh, 28rem);
      border-radius: 0;
    }

    .hero--inline {
      height: auto;
      aspect-ratio: 16 / 9;
      margin-block: var(--space-4);
      border-radius: var(--radius-lg);
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
      gap: var(--space-3);
      margin-block: var(--space-4);
    }

    .fact {
      height: 3.5rem;
      border-radius: var(--radius-md);
    }
  `,
  host: { role: 'status', 'aria-live': 'polite' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly kind = input<SkeletonKind>('rows');
  /** How many rows, cards, tiles, figures, fields or lines of text. */
  readonly count = input(6);

  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, index) => index));

  protected width(item: number, shift: number): string {
    return WIDTHS[(item + shift) % WIDTHS.length]!;
  }
}
