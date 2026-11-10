import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { MarkdownPipe } from '../../format/markdown.pipe';
import { ParisDatePipe } from '../../format/paris-date.pipe';
import { CAP_PATH } from '../../routing/links';
import { CoverImage } from '../cover-image/cover-image';
import { Icon } from '../icon/icon';
import { PhotoViewer, ViewedPhoto } from '../photo-viewer/photo-viewer';
import { articlePhotos, frenchDay, isSitePath } from './article-format';

/** What an article shows: from the API, or from the editor for its preview. */
export interface CapArticleContent {
  title: string;
  subtitle?: string | null;
  happenedOn: string;
  imageId?: string | null;
  style: 'CLASSIC' | 'NOTEBOOK';
  blocks: CapBlock[];
}

const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

/**
 * An article of "Mon CAP", as visitors read it: the date, the title and its subtitle above the big
 * photo (never on it), then the blocks in the chosen order, the text in a narrow column, the photos
 * as wide as the article. Every photo opens big. "Carnet" gives it a "cahier de cours" look, the date
 * put forward; both styles keep the site's colors and fonts.
 */
@Component({
  selector: 'yona-cap-article-view',
  imports: [CoverImage, Icon, MarkdownPipe, ParisDatePipe, PhotoViewer, RouterLink],
  template: `
    <article class="article" [class.is-notebook]="notebook()">
      <header class="article__head">
        @if (notebook()) {
          <time class="article__badge" [attr.datetime]="article().happenedOn">
            <span class="article__day">{{ day() }}</span>
            <span class="article__month">{{ monthYear() }}</span>
          </time>
        } @else {
          <time class="article__date" [attr.datetime]="article().happenedOn">{{ article().happenedOn | parisDate }}</time>
        }
        <h1 class="article__title">{{ article().title || 'Titre de l’article' }}</h1>
        @if (article().subtitle; as subtitle) {
          <p class="article__subtitle">{{ subtitle }}</p>
        }
      </header>

      @if (article().imageId; as imageId) {
        <button type="button" class="photo article__cover" [attr.aria-label]="'Voir en grand : ' + article().title" (click)="viewer.openPhoto(imageId)">
          <yona-cover-image [imageId]="imageId" [alt]="article().title" sizes="(min-width: 64rem) 56rem, 100vw" [priority]="!preview()" />
        </button>
      }

      <div class="article__blocks" (click)="followLink($event)">
        @for (block of article().blocks; track $index) {
          @switch (block.type) {
            @case ('TEXT') {
              @if (block.text; as text) {
                <div class="column prose" [innerHTML]="text | markdown"></div>
              }
            }
            @case ('IMAGE') {
              @if (block.imageId; as imageId) {
                <figure class="wide">
                  <button type="button" class="photo photo--wide" [attr.aria-label]="'Voir en grand' + (block.caption ? ' : ' + block.caption : '')" (click)="viewer.openPhoto(imageId)">
                    <yona-cover-image [imageId]="imageId" [alt]="block.caption ?? ''" sizes="(min-width: 64rem) 56rem, 100vw" />
                  </button>
                  @if (block.caption; as caption) {
                    <figcaption class="caption">{{ caption }}</figcaption>
                  }
                </figure>
              }
            }
            @case ('IMAGE_TEXT') {
              <div class="wide photo-text" [class.is-right]="block.side === 'RIGHT'" [class.is-alone]="!block.imageId">
                @if (block.imageId; as imageId) {
                  <figure class="photo-text__figure">
                    <button type="button" class="photo photo--side" [attr.aria-label]="'Voir en grand' + (block.caption ? ' : ' + block.caption : '')" (click)="viewer.openPhoto(imageId)">
                      <yona-cover-image [imageId]="imageId" [alt]="block.caption ?? ''" sizes="(min-width: 64rem) 19rem, 100vw" />
                    </button>
                    @if (block.caption; as caption) {
                      <figcaption class="caption">{{ caption }}</figcaption>
                    }
                  </figure>
                }
                @if (block.text; as text) {
                  <div class="prose photo-text__text" [innerHTML]="text | markdown"></div>
                }
              </div>
            }
            @case ('STEPS') {
              <ol role="list" class="wide steps" [class.is-four]="(block.photos?.length ?? 0) % 4 === 0">
                @for (photo of block.photos; track $index; let i = $index) {
                  @if (photo.imageId; as imageId) {
                    <li class="steps__item">
                      <button type="button" class="photo photo--step" [attr.aria-label]="'Voir en grand : étape ' + (i + 1)" (click)="viewer.openPhoto(imageId)">
                        <yona-cover-image [imageId]="imageId" [alt]="photo.caption ?? ''" sizes="(min-width: 64rem) 14rem, 50vw" />
                      </button>
                      <p class="steps__caption"><span class="steps__number" aria-hidden="true">{{ i + 1 }}</span>{{ photo.caption }}</p>
                    </li>
                  }
                }
              </ol>
            }
            @case ('TIP') {
              @if (block.text; as text) {
                <aside class="column tip">
                  <p class="tip__title"><svg yonaIcon="lightbulb" [size]="18"></svg>Astuce à retenir</p>
                  <p class="tip__text">{{ text }}</p>
                </aside>
              }
            }
          }
        }
      </div>

      @if (backLinks()) {
        <nav class="column article__back" aria-label="Retour">
          <a [routerLink]="capPath"><svg yonaIcon="arrow-left" [size]="16"></svg>Tous les articles</a>
          <a routerLink="/"><svg yonaIcon="arrow-left" [size]="16"></svg>Accueil</a>
        </nav>
      }
    </article>
    <yona-photo-viewer #viewer [photos]="photos()" />
  `,
  styleUrl: './cap-article-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapArticleView {
  readonly article = input.required<CapArticleContent>();
  /** "Tous les articles" and "Accueil" under the article. */
  readonly backLinks = input(false, { transform: booleanAttribute });
  /** In the editor: its photo is not the page's first image. */
  readonly preview = input(false, { transform: booleanAttribute });

  private readonly router = inject(Router);
  protected readonly capPath = CAP_PATH;
  protected readonly notebook = computed(() => this.article().style === 'NOTEBOOK');
  /** "1er", "12": the day as French writes it. */
  protected readonly day = computed(() => frenchDay(this.article().happenedOn));
  protected readonly monthYear = computed(() => MONTH_YEAR.format(new Date(this.article().happenedOn)));
  /** Every photo, in the order of the page, to go from one to the next once big. */
  protected readonly photos = computed<ViewedPhoto[]>(() => articlePhotos(this.article()));

  /** A link of the text to a page of the site (a recipe) opens without reloading the site. */
  protected followLink(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!isSitePath(href) || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(href);
  }
}
