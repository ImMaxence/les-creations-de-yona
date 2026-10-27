import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getPublishedRecipe } from '../../core/api/generated/fn/recipes/get-published-recipe';
import { MenuDetail } from '../../core/api/generated/models/menu-detail';
import { ShoppingList, shoppingRecipeOf } from '../../core/kitchen/shopping-list';
import { Toaster } from '../../core/notifications/toaster';
import { Reveal } from '../../shared/motion/reveal';
import { MENUS_PATH, SHOPPING_LIST_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';

/**
 * A menu: its recipes, in the order Yona chose, all added to the shopping list at once (each for
 * the servings of its recipe; changed later on its own page).
 */
@Component({
  selector: 'yona-menu',
  imports: [Button, Icon, RecipeCard, Reveal, RouterLink],
  template: `
    <article class="container menu">
      <header class="menu__head">
        <a class="eyebrow enter" [routerLink]="menusPath">Menus</a>
        <h1 class="enter" style="--delay: 60ms">{{ menu().title }}</h1>
        @if (menu().intro) {
          <p class="menu__intro enter" style="--delay: 120ms">{{ menu().intro }}</p>
        }
        <div class="menu__actions enter" style="--delay: 180ms">
          <button yonaButton type="button" [disabled]="adding()" (click)="addAll()">
            <svg yonaIcon="shopping-basket"></svg>
            {{ adding() ? 'Ajout…' : 'Tout ajouter à ma liste de courses' }}
          </button>
          @if (added()) {
            <a class="menu__list-link" [routerLink]="shoppingListPath">Voir ma liste</a>
          }
        </div>
      </header>

      <section aria-labelledby="menu-recipes">
        <h2 id="menu-recipes" class="menu__count">{{ countLabel() }}</h2>
        <ul role="list" class="recipe-grid">
          @for (recipe of menu().recipes; track recipe.slug; let i = $index) {
            <li yonaReveal [revealDelay]="(i % 3) * 90"><yona-recipe-card [recipe]="recipe" [priority]="i === 0" /></li>
          }
        </ul>
      </section>
    </article>
  `,
  styleUrl: './menus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Menu {
  /** From menuResolver. */
  readonly menu = input.required<MenuDetail>();

  private readonly api = inject(Api);
  private readonly shoppingList = inject(ShoppingList);
  private readonly toaster = inject(Toaster);
  protected readonly menusPath = MENUS_PATH;
  protected readonly shoppingListPath = SHOPPING_LIST_PATH;
  protected readonly adding = signal(false);
  protected readonly added = signal(false);
  protected readonly countLabel = computed(() => {
    const count = this.menu().recipes.length;
    return count > 1 ? `${count} recettes` : '1 recette';
  });

  /** Each recipe read in full (its ingredients), then added; one unavailable does not stop the others. */
  protected async addAll(): Promise<void> {
    this.adding.set(true);
    const recipes = await Promise.allSettled(
      this.menu().recipes.map((recipe) => this.api.invoke(getPublishedRecipe, { slug: recipe.slug })),
    );
    this.adding.set(false);
    const found = recipes.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    found.forEach((recipe) => this.shoppingList.add(shoppingRecipeOf(recipe)));
    if (!found.length) {
      this.toaster.error('Impossible de lire les recettes pour le moment : réessayez');
      return;
    }
    this.added.set(true);
    this.toaster.success(
      found.length === recipes.length
        ? 'Les ingrédients du menu sont dans votre liste de courses'
        : `${found.length} recettes sur ${recipes.length} ajoutées : les autres n'ont pas pu être lues`,
    );
  }
}
