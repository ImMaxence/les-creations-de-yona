import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapHighlight } from '../../core/api/generated/models/cap-highlight';
import { NewRecipeNotifications } from '../../core/pwa/new-recipe-notifications';
import { SiteData } from '../../core/site/site-data';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { paragraphs } from '../../shared/format/paragraphs';
import { ABOUT_PATH, capArticleLink } from '../../shared/routing/links';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';
import { NotifyButton } from '../../shared/ui/notify-button/notify-button';

/**
 * Under the menus of the home page: who writes (photo and text of "À propos"), the notifications of
 * new recipes, and an article of "Mon CAP" to read (the one put forward, otherwise the latest), framed
 * together by four rounded corners.
 */
@Component({
  selector: 'yona-about-zone',
  imports: [CoverImage, Icon, NotifyButton, ParisDatePipe, RouterLink],
  templateUrl: './about-zone.html',
  styleUrl: './about-zone.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutZone {
  /** From homeResolver: null before the first article. */
  readonly article = input<CapHighlight | null>(null);

  private readonly siteData = inject(SiteData);
  private readonly notifications = inject(NewRecipeNotifications);
  protected readonly content = this.siteData.content;
  /** A blank line in the text written in the back-office starts a new paragraph. */
  protected readonly aboutParagraphs = computed(() => paragraphs(this.content().aboutText));
  /** Only where notifications can work, or on iPhone where installing the app comes first. */
  protected readonly showNotify = computed(() => !['unknown', 'unsupported'].includes(this.notifications.state()));
  protected readonly aboutPath = ABOUT_PATH;
  protected readonly capArticleLink = capArticleLink;
}
