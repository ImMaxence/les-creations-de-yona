import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideEye, LucidePencil, LucideX } from '@lucide/angular';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import RecipePage from '../../recipe/recipe';

/**
 * A recipe exactly as visitors see it, drafts included, under an "Aperçu" banner. Admins only:
 * the page /admin/apercu/{id} (saved version), or the editor's full-screen preview (the form as
 * it stands, saved or not).
 */
@Component({
  selector: 'yona-recipe-preview',
  imports: [RouterLink, RecipePage, LucideEye, LucidePencil, LucideX],
  templateUrl: './recipe-preview.html',
  styleUrl: './recipe-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RecipePreview {
  /** From adminRecipeResolver on /admin/apercu/{id}, or given by the editor. */
  readonly recipe = input.required<RecipeDetail>();
  /** In the editor: a "Fermer" button instead of "Modifier", and the recipe's links are inactive. */
  readonly closable = input(false, { transform: booleanAttribute });
  /** The form has changes not saved yet, shown in this preview. */
  readonly unsaved = input(false);
  readonly closed = output();

  constructor() {
    // Caught before the links themselves: in the editor, following one would leave the form
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'click',
      (event) => {
        if (this.closable() && (event.target as Element).closest('.preview__page a')) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true },
    );
  }
}
