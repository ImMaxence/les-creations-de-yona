import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Favorites } from '../../kitchen/favorites';
import { ShoppingList } from '../../kitchen/shopping-list';
import { FAVORITES_PATH, SHOPPING_LIST_PATH } from '../../../shared/routing/links';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Favorites and shopping list, one tap away in the header, with how many each holds. The counts
 * come from the browser: the page rendered by the server shows the icons without them.
 */
@Component({
  selector: 'yona-kitchen-links',
  imports: [Icon, RouterLink, RouterLinkActive],
  template: `
    <a
      class="link"
      routerLinkActive="is-active"
      [routerLink]="favoritesPath"
      [attr.aria-label]="favorites.count() ? 'Mes favoris (' + favorites.count() + ')' : 'Mes favoris'"
    >
      <svg yonaIcon="heart" [size]="20"></svg>
      @if (favorites.count()) {
        <span class="count" aria-hidden="true">{{ favorites.count() }}</span>
      }
    </a>
    <a
      class="link"
      routerLinkActive="is-active"
      [routerLink]="shoppingListPath"
      [attr.aria-label]="shoppingList.count() ? 'Ma liste de courses (' + shoppingList.count() + ')' : 'Ma liste de courses'"
    >
      <svg yonaIcon="shopping-basket" [size]="20"></svg>
      @if (shoppingList.count()) {
        <span class="count" aria-hidden="true">{{ shoppingList.count() }}</span>
      }
    </a>
  `,
  styles: `
    :host {
      display: flex;
      gap: var(--space-1);
    }

    .link {
      position: relative;
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      color: var(--color-text);
      transition: background-color var(--duration-fast) var(--ease-out);

      &:hover,
      &.is-active {
        background-color: var(--color-surface);
      }

      &.is-active {
        color: var(--color-accent);
      }
    }

    .count {
      position: absolute;
      top: 0.1rem;
      right: 0.05rem;
      min-width: 1.1rem;
      height: 1.1rem;
      padding: 0 0.25rem;
      border-radius: 999px;
      background-color: var(--color-accent);
      color: var(--color-on-accent);
      font-size: 0.65rem;
      font-weight: 700;
      line-height: 1.1rem;
      text-align: center;
      animation: pop var(--duration-base) var(--ease-out);
    }

    @keyframes pop {
      from {
        transform: scale(0.4);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .count {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitchenLinks {
  protected readonly favorites = inject(Favorites);
  protected readonly shoppingList = inject(ShoppingList);
  protected readonly favoritesPath = FAVORITES_PATH;
  protected readonly shoppingListPath = SHOPPING_LIST_PATH;
}
