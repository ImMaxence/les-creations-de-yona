import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteData } from '../../core/site/site-data';
import { paragraphs } from '../../shared/format/paragraphs';
import { FEEDBACK_PATH, RECIPES_PATH } from '../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../shared/ui/brand-icon/brand-icon';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Who writes the recipes: the "À propos" text and photo of the home page (edited in the
 * back-office, Préférences), with Yona's networks. Its own page for search engines and AI
 * assistants, which look for the author behind a recipe.
 */
@Component({
  selector: 'yona-about',
  imports: [RouterLink, BrandIcon, Button, Icon],
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class About {
  protected readonly siteData = inject(SiteData);
  protected readonly content = this.siteData.content;
  protected readonly paragraphs = computed(() => paragraphs(this.content().aboutText));
  protected readonly socialPlatformLabel = socialPlatformLabel;
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
}
