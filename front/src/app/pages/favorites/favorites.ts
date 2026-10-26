import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Favorites as FavoriteRecipes } from '../../core/kitchen/favorites';
import { RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * "Mes favoris": the recipes marked with the heart, kept in this browser only. Shown from what was
 * kept (title, photo, categories), so the page also works offline in the installed app.
 */
@Component({
  selector: 'yona-favorites',
  imports: [Icon, RouterLink, Button, RecipeCard],
  template: `
    <section class="container favorites">
      <header class="favorites__head">
        <p class="eyebrow enter">Gardées dans ce navigateur</p>
        <h1 class="favorites__title enter" style="--delay: 80ms">Mes favoris</h1>
        <p class="favorites__hint enter" style="--delay: 140ms">
          Touchez le cœur d'une recette pour la retrouver ici, même hors connexion avec l'application installée. Rien
          n'est envoyé au site : vos favoris restent sur cet appareil.
        </p>
      </header>

      @if (!shown()) {
        <!-- The server knows nothing of this browser's favorites: shown once in the browser -->
      } @else if (favorites.list().length) {
        <ul role="list" class="recipe-grid">
          @for (recipe of favorites.list(); track recipe.slug) {
            <li class="favorite">
              <yona-recipe-card [recipe]="recipe" />
              <button
                type="button"
                class="favorite__remove"
                [attr.aria-label]="'Retirer « ' + recipe.title + ' » des favoris'"
                (click)="favorites.remove(recipe.slug)"
              >
                <svg yonaIcon="x" [size]="18"></svg>
              </button>
            </li>
          }
        </ul>
      } @else {
        <div class="empty">
          <div class="empty__icon" aria-hidden="true"><svg yonaIcon="heart" [size]="40" [strokeWidth]="1.5"></svg></div>
          <h2>Aucun favori pour le moment</h2>
          <p>Sur une recette, touchez le cœur en haut de la photo.</p>
          <a yonaButton [routerLink]="recipesPath">Voir les recettes</a>
        </div>
      }
    </section>
  `,
  styleUrl: './favorites.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Favorites {
  protected readonly favorites = inject(FavoriteRecipes);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly shown = signal(false);

  constructor() {
    afterNextRender(() => this.shown.set(true));
  }
}
