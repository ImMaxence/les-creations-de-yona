import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { emptyRecipeTrash } from '../../../core/api/generated/fn/admin-recipe-trash/empty-recipe-trash';
import { eraseTrashedRecipe } from '../../../core/api/generated/fn/admin-recipe-trash/erase-trashed-recipe';
import { listTrashedRecipes } from '../../../core/api/generated/fn/admin-recipe-trash/list-trashed-recipes';
import { restoreTrashedRecipe } from '../../../core/api/generated/fn/admin-recipe-trash/restore-trashed-recipe';
import { TrashedRecipe } from '../../../core/api/generated/models/trashed-recipe';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Icon } from '../../../shared/ui/icon/icon';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deleted recipes, kept 30 days before being erased: restored in one click, as they were (URL,
 * dates, photos), or erased at once.
 */
@Component({
  selector: 'yona-admin-trash',
  imports: [Icon, RouterLink, Button, CoverImage, ParisDatePipe],
  templateUrl: './admin-trash.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminTrash {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly recipes = resource({ loader: () => this.api.invoke(listTrashedRecipes) });
  protected readonly busyId = signal<number | null>(null);

  /** "Effacée dans 12 jours", "effacée cette nuit". */
  protected daysLeft(recipe: TrashedRecipe): string {
    const days = Math.ceil((new Date(recipe.erasedAt).getTime() - Date.now()) / DAY_MS);
    return days <= 1 ? 'effacée la nuit prochaine' : `effacée dans ${days} jours`;
  }

  protected async restore(recipe: TrashedRecipe): Promise<void> {
    this.busyId.set(recipe.id);
    const restored = await attempt(this.api.invoke(restoreTrashedRecipe, { id: recipe.id }));
    this.busyId.set(null);
    if (restored.ok) {
      this.toaster.success(
        restored.value.status === 'PUBLISHED'
          ? `« ${restored.value.title} » est de nouveau en ligne.`
          : `« ${restored.value.title} » est restaurée en brouillon.`,
      );
      this.recipes.reload();
    }
  }

  /** The restored recipe, to check it at once. */
  protected async restoreAndOpen(recipe: TrashedRecipe): Promise<void> {
    this.busyId.set(recipe.id);
    const restored = await attempt(this.api.invoke(restoreTrashedRecipe, { id: recipe.id }));
    this.busyId.set(null);
    if (restored.ok) {
      this.toaster.success(`« ${restored.value.title} » est restaurée.`);
      await this.router.navigate(['/admin/recettes', restored.value.id]);
    }
  }

  protected async erase(recipe: TrashedRecipe): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Effacer définitivement ?',
      message: `« ${recipe.title} » ne pourra plus être restaurée. Sa photo reste dans la galerie.`,
      confirmLabel: 'Effacer',
    });
    if (confirmed && (await attempt(this.api.invoke(eraseTrashedRecipe, { id: recipe.id }))).ok) {
      this.toaster.success('Recette effacée.');
      this.recipes.reload();
    }
  }

  protected async emptyTrash(): Promise<void> {
    const count = this.recipes.value()?.length ?? 0;
    const confirmed = await this.confirm.ask({
      title: 'Vider la corbeille ?',
      message:
        count > 1
          ? `Les ${count} recettes de la corbeille seront effacées et ne pourront plus être restaurées.`
          : 'La recette de la corbeille sera effacée et ne pourra plus être restaurée.',
      confirmLabel: 'Vider la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(emptyRecipeTrash))).ok) {
      this.toaster.success('Corbeille vidée.');
      this.recipes.reload();
    }
  }
}
