import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapArticleCard } from '../../core/api/generated/models/cap-article-card';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPES_PATH, capArticleLink } from '../../shared/routing/links';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * "Mon CAP": the road to the diploma as a timeline of articles, the latest first. Each one in short
 * (its photo, title, subtitle and first lines); the whole card opens its page.
 */
@Component({
  selector: 'yona-cap',
  imports: [CoverImage, Icon, ParisDatePipe, Reveal, RouterLink],
  template: `
    <section class="container cap">
      <header class="cap__head">
        <p class="eyebrow enter">Le carnet de route</p>
        <h1 class="enter" style="--delay: 60ms">Mon CAP</h1>
        <p class="cap__lead enter" style="--delay: 120ms">
          Toutes les étapes de mon CAP Pâtisserie, article par article : ce que j'apprends, ce que je rate et ce que je réussis
        </p>
      </header>

      @if (entries().length) {
        <ol role="list" class="timeline">
          @for (entry of entries(); track entry.id) {
            <li class="timeline__item" yonaReveal>
              <time class="timeline__date" [attr.datetime]="entry.happenedOn">{{ entry.happenedOn | parisDate }}</time>
              <article class="card">
                @if (entry.imageId) {
                  <yona-cover-image class="card__image" [imageId]="entry.imageId" sizes="(min-width: 48rem) 40rem, 100vw" />
                }
                <div class="card__text">
                  <h2 class="card__title">
                    <!-- Stretched over the whole card: a tap anywhere opens the article -->
                    <a class="card__link" [routerLink]="link(entry)">{{ entry.title }}</a>
                  </h2>
                  @if (entry.subtitle; as subtitle) {
                    <p class="card__subtitle">{{ subtitle }}</p>
                  }
                  @if (entry.excerpt; as excerpt) {
                    <p class="card__excerpt">{{ excerpt }}</p>
                  }
                  <span class="card__more" aria-hidden="true">Lire la suite <svg yonaIcon="arrow-right" [size]="16"></svg></span>
                </div>
              </article>
            </li>
          }
        </ol>
      } @else {
        <p class="cap__empty">Les premiers articles arrivent bientôt. En attendant, <a [routerLink]="recipesPath">voir les recettes</a></p>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

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
      gap: var(--space-7);
      padding-left: var(--space-5);
      border-left: 2px solid var(--color-line);
    }

    .timeline__item {
      position: relative;
      display: grid;
      gap: var(--space-3);

      // The dot on the line, beside the date
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

    .card {
      position: relative;
      display: grid;
      max-width: 40rem;
      overflow: hidden;
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
      transition:
        box-shadow var(--duration-base) var(--ease-out),
        transform var(--duration-base) var(--ease-out);

      @include m.hover {
        box-shadow: 0 0.75rem 2rem -1rem color-mix(in srgb, var(--color-text) 35%, transparent);
        transform: translateY(-2px);

        .card__more svg {
          transform: translateX(3px);
        }
      }

      &:focus-within {
        @include m.focus-ring;
      }
    }

    .card__image {
      position: relative;
      display: block;
      aspect-ratio: 16 / 9;
      overflow: hidden;
    }

    .card__text {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-5);
    }

    .card__title {
      font-size: var(--text-xl);
    }

    .card__link {
      color: inherit;
      text-decoration: none;

      &::after {
        content: '';
        position: absolute;
        inset: 0;
      }

      &:focus-visible {
        outline: none;
      }
    }

    .card__subtitle {
      color: var(--color-text-muted);
      font-weight: 600;
    }

    .card__excerpt {
      @include m.line-clamp(4);
      color: var(--color-text-muted);
      line-height: 1.6;
    }

    .card__more {
      display: inline-flex;
      align-items: center;
      justify-self: start;
      gap: var(--space-1);
      margin-top: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      background-color: var(--color-accent);
      color: var(--color-on-accent);
      font-size: var(--text-sm);
      font-weight: 600;

      svg {
        transition: transform var(--duration-base) var(--ease-out);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Cap {
  /** From capEntriesResolver. */
  readonly entries = input<CapArticleCard[]>([]);

  protected readonly recipesPath = RECIPES_PATH;
  protected readonly link = capArticleLink;
}
