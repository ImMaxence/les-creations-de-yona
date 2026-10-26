import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

type StarFill = 'full' | 'half' | 'empty';

const MAX_STARS = 5;

/**
 * Difficulty of a recipe, from 1 to 5 by half points, as five stars. Screen readers get the
 * value in words: the stars themselves are decorative.
 */
@Component({
  selector: 'yona-difficulty-stars',
  imports: [Icon],
  template: `
    <span class="visually-hidden">{{ label() }}</span>
    <span class="stars" aria-hidden="true">
      @for (fill of stars(); track $index) {
        <span class="star" [class]="'star--' + fill">
          <svg yonaIcon="star" class="star__outline" [size]="size()"></svg>
          <svg yonaIcon="star" class="star__fill" [size]="size()" fill="currentColor"></svg>
        </span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .stars {
      display: inline-flex;
      gap: 0.15em;
      color: var(--color-accent);
    }

    .star {
      position: relative;
      display: inline-grid;
    }

    .star__outline {
      opacity: 0.4;
    }

    .star__fill {
      position: absolute;
      inset: 0;
    }

    .star--empty .star__fill {
      display: none;
    }

    .star--half .star__fill {
      clip-path: inset(0 50% 0 0);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyStars {
  /** 1 to 5, by half points. */
  readonly value = input.required<number>();
  readonly size = input(18);

  protected readonly stars = computed<StarFill[]>(() =>
    Array.from({ length: MAX_STARS }, (_star, index) => {
      const remaining = this.value() - index;
      return remaining >= 1 ? 'full' : remaining >= 0.5 ? 'half' : 'empty';
    }),
  );
  protected readonly label = computed(
    () => `Difficulté : ${this.value().toLocaleString('fr-FR')} sur ${MAX_STARS}`,
  );
}
