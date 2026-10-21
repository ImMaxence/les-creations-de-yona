import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeCard as RecipeCardModel } from '../../../core/api/generated/models/recipe-card';
import { ParisDatePipe } from '../../format/paris-date.pipe';
import { RECIPE_IMAGE_TRANSITION, isSameTabClick } from '../../motion/view-transitions';
import { recipeLink } from '../../routing/links';
import { CoverImage } from '../cover-image/cover-image';

@Component({
  selector: 'yona-recipe-card',
  imports: [RouterLink, CoverImage, ParisDatePipe],
  templateUrl: './recipe-card.html',
  styleUrl: './recipe-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCard {
  readonly recipe = input.required<RecipeCardModel>();
  /** First card of a page, likely the largest image on screen: loaded first. */
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly link = computed(() => recipeLink(this.recipe()));
  protected readonly imageTransitionName = signal<string | null>(null);

  protected onClick(event: MouseEvent): void {
    if (isSameTabClick(event)) {
      this.imageTransitionName.set(RECIPE_IMAGE_TRANSITION);
    }
  }
}
