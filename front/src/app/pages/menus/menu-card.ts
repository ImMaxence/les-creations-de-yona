import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuSummary } from '../../core/api/generated/models/menu-summary';
import { menuLink } from '../../shared/routing/links';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { Icon } from '../../shared/ui/icon/icon';

/** A menu in a grid (page of the menus, home page): the photo of its first recipe, its title, its size. */
@Component({
  selector: 'yona-menu-card',
  imports: [CoverImage, Icon, RouterLink],
  template: `
    <a class="menu-card" [routerLink]="link()">
      <yona-cover-image class="menu-card__image" [imageId]="menu().imageId" sizes="(width >= 48rem) 24rem, 100vw" />
      <span class="menu-card__body">
        <span class="menu-card__count">
          <svg yonaIcon="utensils-crossed" [size]="14"></svg>
          {{ menu().recipeCount }} recette{{ menu().recipeCount > 1 ? 's' : '' }}
        </span>
        <span class="menu-card__title">{{ menu().title }}</span>
        @if (menu().intro) {
          <span class="menu-card__intro">{{ menu().intro }}</span>
        }
      </span>
    </a>
  `,
  styleUrl: './menu-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuCard {
  readonly menu = input.required<MenuSummary>();
  protected readonly link = computed(() => menuLink(this.menu()));
}
