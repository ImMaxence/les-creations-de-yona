import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageResponseObservationResponse } from '../../core/api/generated/models/page-response-observation-response';
import { MarkdownPipe } from '../../shared/format/markdown.pipe';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { Reveal } from '../../shared/motion/reveal';
import { CAP_PATH, recipeLinkOf } from '../../shared/routing/links';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';
import { Pagination } from '../../shared/ui/pagination/pagination';

/** "Mes observations": what was noticed while cooking, about a recipe or about none. */
@Component({
  selector: 'yona-observations',
  imports: [CoverImage, Icon, MarkdownPipe, Pagination, ParisDatePipe, Reveal, RouterLink],
  template: `
    <section class="container observations">
      <header class="observations__head">
        <a class="observations__back enter" [routerLink]="capPath"><svg yonaIcon="arrow-left" [size]="16"></svg>Mon CAP</a>
        <h1 class="enter" style="--delay: 60ms">Mes observations</h1>
        <p class="observations__lead enter" style="--delay: 120ms">
          Ce que je remarque en cuisinant : ce qui a marché, ce qui a raté et ce que je changerai la prochaine fois
        </p>
      </header>

      @if (items().length) {
        <ul role="list" class="observations__list">
          @for (observation of items(); track observation.id) {
            <li class="observation" yonaReveal>
              @if (observation.imageId) {
                <yona-cover-image class="observation__image" [imageId]="observation.imageId" [alt]="observation.title" sizes="(min-width: 768px) 24rem, 100vw" />
              }
              <div class="observation__text">
                <time class="observation__date" [attr.datetime]="observation.observedOn">{{ observation.observedOn | parisDate }}</time>
                <h2 class="observation__title">{{ observation.title }}</h2>
                <div class="prose" [innerHTML]="observation.body | markdown"></div>
                @if (observation.recipe; as recipe) {
                  <a class="observation__recipe" [routerLink]="recipeLinkOf(recipe)"><svg yonaIcon="book-open" [size]="16"></svg>{{ recipe.title }}</a>
                } @else {
                  <span class="observation__none">Pas de recette</span>
                }
              </div>
            </li>
          }
        </ul>
        @if (observations(); as result) {
          @if (result.totalPages > 1) {
            <yona-pagination [page]="result.page + 1" [totalPages]="result.totalPages" />
          }
        }
      } @else {
        <p class="observations__empty">Pas encore d'observation par ici</p>
      }
    </section>
  `,
  styles: `
    .observations {
      display: grid;
      gap: var(--space-8);
      padding-block: var(--space-8);
    }

    .observations__head {
      display: grid;
      gap: var(--space-3);
      justify-items: start;
    }

    .observations__back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-accent);
    }

    .observations__lead {
      max-width: 40rem;
      color: var(--color-text-muted);
    }

    .observations__empty {
      color: var(--color-text-muted);
    }

    .observations__list {
      display: grid;
      gap: var(--space-4);
    }

    .observation {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);

      @media (min-width: 48rem) {
        grid-template-columns: 16rem 1fr;
      }
    }

    .observation__image {
      position: relative;
      display: block;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      border-radius: var(--radius-md);
    }

    .observation__text {
      display: grid;
      gap: var(--space-2);
      align-content: start;
      // Spans both columns when there is no photo
      grid-column: 1 / -1;
    }

    .observation__image + .observation__text {
      grid-column: auto;
    }

    .observation__date {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .observation__title {
      font-size: var(--text-xl);
    }

    .observation__recipe {
      display: inline-flex;
      align-items: center;
      justify-self: start;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-accent);
    }

    .observation__none {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Observations {
  /** From observationsResolver. */
  readonly observations = input<PageResponseObservationResponse>();

  protected readonly capPath = CAP_PATH;
  protected readonly recipeLinkOf = recipeLinkOf;
  protected readonly items = computed(() => this.observations()?.content ?? []);
}
