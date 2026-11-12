import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LinkPreview } from '../../../core/api/generated/models/link-preview';
import { Icon } from '../../../shared/ui/icon/icon';
import { linkHost } from './message-format';
import { iconLike, messagePhoto } from './message-photos';

/** How the card shows: the page's image on top, the site's icon beside the title, or the site's name alone. */
type CardKind = 'image' | 'icon' | 'none';

/**
 * The page a link of a message leads to, as on a phone: its image on top, or the site's icon beside its
 * title, or the site's name alone (a page that could not be read). Opens it in another tab.
 */
@Component({
  selector: 'yona-link-card',
  imports: [Icon],
  template: `
    @let shown = link();
    <a class="link-card" [class.has-image]="kind() === 'image'" [href]="shown.url" target="_blank" rel="noopener noreferrer">
      @if (kind() === 'image') {
        <img class="link-card__image" [src]="messagePhoto(shown.imageId!)" alt="" loading="lazy" [width]="shown.imageWidth ?? 800" [height]="shown.imageHeight ?? 420" />
      }
      <span class="link-card__body">
        @if (kind() === 'icon') {
          <img class="link-card__icon" [src]="messagePhoto(shown.imageId!)" alt="" loading="lazy" />
        } @else if (kind() === 'none') {
          <span class="link-card__icon link-card__icon--none" aria-hidden="true"><svg yonaIcon="link" [size]="18"></svg></span>
        }
        <span class="link-card__text">
          <strong class="link-card__title">{{ shown.title || shown.siteName || host() }}</strong>
          @if (shown.description && kind() !== 'image') {
            <span class="link-card__description">{{ shown.description }}</span>
          }
          <span class="link-card__site">{{ host() }}</span>
        </span>
      </span>
    </a>
  `,
  styleUrl: './link-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkCard {
  readonly link = input.required<LinkPreview>();

  protected readonly messagePhoto = messagePhoto;
  protected readonly host = computed(() => linkHost(this.link().url));
  protected readonly kind = computed<CardKind>(() => {
    const link = this.link();
    if (!link.imageId) {
      return 'none';
    }
    return iconLike(link.imageWidth, link.imageHeight) ? 'icon' : 'image';
  });
}
