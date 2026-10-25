import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideEye, LucidePencil } from '@lucide/angular';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import RecipePage from '../../recipe/recipe';

/**
 * A recipe exactly as visitors see it, drafts included. Admins only: the page /admin/apercu/{id}
 * (saved version, under an "Aperçu" banner), or the editor's full-screen dialog (the form as it
 * stands, saved or not; the dialog's head says it is a preview).
 */
@Component({
  selector: 'yona-recipe-preview',
  imports: [RouterLink, RecipePage, LucideEye, LucidePencil],
  templateUrl: './recipe-preview.html',
  styleUrl: './recipe-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RecipePreview {
  /** From adminRecipeResolver on /admin/apercu/{id}, or given by the editor. */
  readonly recipe = input.required<RecipeDetail>();
  /** In the editor's dialog: no banner, and the recipe's links are inactive. */
  readonly embedded = input(false, { transform: booleanAttribute });

  constructor() {
    // Caught before the links themselves: in the editor, following one would leave the form
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'click',
      (event) => {
        if (this.embedded() && (event.target as Element).closest('.preview__page a')) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true },
    );
  }
}
