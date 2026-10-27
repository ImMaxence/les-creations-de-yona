import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { createTag } from '../../../core/api/generated/fn/admin-tags/create-tag';
import { deleteTags } from '../../../core/api/generated/fn/admin-tags/delete-tags';
import { listAdminTags } from '../../../core/api/generated/fn/admin-tags/list-admin-tags';
import { renameTag } from '../../../core/api/generated/fn/admin-tags/rename-tag';
import { TagSummary } from '../../../core/api/generated/models/tag-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { Button } from '../../../shared/ui/button/button';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { ADMIN_RECIPES_QUERY } from '../recipes/admin-recipes-query';
import { Selection } from '../selection';
import { Icon } from '../../../shared/ui/icon/icon';

const MAX_NAME_LENGTH = 40;

/**
 * Tags of the recipes (végétarien, sans gluten, de saison…): visitors filter the recipes on them.
 * Unlike a category, a tag in use can be deleted: it is taken off its recipes.
 */
@Component({
  selector: 'yona-admin-tags',
  imports: [Icon, RouterLink, BulkBar, Button],
  templateUrl: './admin-tags.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminTags {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly tags = resource({ loader: () => this.api.invoke(listAdminTags) });
  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly newName = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected readonly editedName = signal('');

  protected readonly selection = new Selection<number>();
  protected readonly tagIds = computed(() => this.tags.value()?.map((tag) => tag.id) ?? []);
  protected readonly deleting = signal(false);

  /** The back-office recipe list, filtered on this tag. */
  protected recipesLink(tag: TagSummary): Record<string, string> {
    return { [ADMIN_RECIPES_QUERY.tag]: tag.slug };
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name) {
      this.toaster.error('Donnez un nom au tag');
      return;
    }
    const created = await attempt(this.api.invoke(createTag, { body: { name } }));
    if (created.ok) {
      this.newName.set('');
      this.toaster.success(`Tag « ${created.value.name} » créé`);
      this.tags.reload();
    }
  }

  protected startRename(tag: TagSummary): void {
    this.editingId.set(tag.id);
    this.editedName.set(tag.name);
  }

  protected async rename(tag: TagSummary): Promise<void> {
    const name = this.editedName().trim();
    if (!name || name === tag.name) {
      this.editingId.set(null);
      return;
    }
    if ((await attempt(this.api.invoke(renameTag, { id: tag.id, body: { name } }))).ok) {
      this.editingId.set(null);
      this.toaster.success('Tag renommé');
      this.tags.reload();
    }
  }

  protected async remove(tag: TagSummary): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer le tag ?',
      message: tag.recipeCount
        ? `« ${tag.name} » sera retiré de ${tag.recipeCount > 1 ? `ses ${tag.recipeCount} recettes` : 'sa recette'}, qui restent en ligne`
        : `« ${tag.name} » sera supprimé`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteTags, { ids: [tag.id] }))).ok) {
      this.toaster.success('Tag supprimé');
      if (this.selection.has(tag.id)) {
        this.selection.toggle(tag.id);
      }
      this.tags.reload();
    }
  }

  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Supprimer ${count} tags ?` : 'Supprimer le tag ?',
      message: 'Ils seront retirés de leurs recettes, qui restent en ligne',
      confirmLabel: 'Supprimer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteTags, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} tags supprimés` : 'Tag supprimé');
      this.selection.clear();
      this.tags.reload();
    }
  }
}
