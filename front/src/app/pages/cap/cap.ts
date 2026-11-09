import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapEntryResponse } from '../../core/api/generated/models/cap-entry-response';
import { MarkdownPipe } from '../../shared/format/markdown.pipe';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { Reveal } from '../../shared/motion/reveal';
import { OBSERVATIONS_PATH, RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';

/** "Mon CAP": the road to the diploma, step by step, as a dated timeline, the latest first. */
@Component({
  selector: 'yona-cap',
  imports: [Button, CoverImage, Icon, MarkdownPipe, ParisDatePipe, Reveal, RouterLink],
  template: `
    <section class="container cap">
      <header class="cap__head">
        <p class="eyebrow enter">Le carnet de route</p>
        <h1 class="enter" style="--delay: 60ms">Mon CAP</h1>
        <p class="cap__lead enter" style="--delay: 120ms">
          Toutes les étapes de mon CAP Pâtisserie, date par date : ce que j'apprends, ce que je rate et ce que je réussis
        </p>
        <a yonaButton variant="secondary" class="enter" style="--delay: 160ms" [routerLink]="observationsPath">
          <svg yonaIcon="notebook-pen"></svg>Mes observations
        </a>
      </header>

      @if (entries().length) {
        <ol role="list" class="timeline">
          @for (entry of entries(); track entry.id) {
            <li class="timeline__item" yonaReveal>
              <time class="timeline__date" [attr.datetime]="entry.happenedOn">{{ entry.happenedOn | parisDate }}</time>
              <div class="timeline__card">
                <h2 class="timeline__title">{{ entry.title }}</h2>
                @if (entry.imageId) {
                  <yona-cover-image class="timeline__image" [imageId]="entry.imageId" [alt]="entry.title" sizes="(min-width: 768px) 36rem, 100vw" />
                }
                @if (entry.body; as body) {
                  <div class="prose" [innerHTML]="body | markdown"></div>
                }
              </div>
            </li>
          }
        </ol>
      } @else {
        <p class="cap__empty">Les premières étapes arrivent bientôt. En attendant, <a [routerLink]="recipesPath">voir les recettes</a></p>
      }
    </section>
  `,
  styles: `
    .cap {
      display: grid;
      gap: var(--space-8);
      padding-block: var(--space-8);
    }

    .cap__head {
      display: grid;
      gap: var(--space-3);
      justify-items: start;
    }

    .cap__lead {
      max-width: 40rem;
      color: var(--color-text-muted);
    }

    .cap__empty {
      color: var(--color-text-muted);
    }

    .timeline {
      display: grid;
      gap: var(--space-6);
      padding-left: var(--space-5);
      border-left: 2px solid var(--color-line);
    }

    .timeline__item {
      position: relative;
      display: grid;
      gap: var(--space-2);

      // The dot on the line
      &::before {
        content: '';
        position: absolute;
        top: 0.35rem;
        left: calc(-1 * var(--space-5) - 7px);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: var(--color-accent);
      }
    }

    .timeline__date {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-accent);
    }

    .timeline__card {
      display: grid;
      gap: var(--space-3);
      max-width: 40rem;
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
    }

    .timeline__title {
      font-size: var(--text-xl);
    }

    .timeline__image {
      position: relative;
      display: block;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: var(--radius-md);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Cap {
  /** From capEntriesResolver. */
  readonly entries = input<CapEntryResponse[]>([]);

  protected readonly observationsPath = OBSERVATIONS_PATH;
  protected readonly recipesPath = RECIPES_PATH;
}
