import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { createGlossaryTerm } from '../../../core/api/generated/fn/admin-glossary/create-glossary-term';
import { deleteGlossaryTerms } from '../../../core/api/generated/fn/admin-glossary/delete-glossary-terms';
import { listAdminGlossary } from '../../../core/api/generated/fn/admin-glossary/list-admin-glossary';
import { updateGlossaryTerm } from '../../../core/api/generated/fn/admin-glossary/update-glossary-term';
import { GlossaryTermResponse } from '../../../core/api/generated/models/glossary-term-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { byGlossaryName } from '../../../shared/format/glossary';
import { GLOSSARY_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { Selection } from '../selection';
import { MAX_DEFINITION_LENGTH, MAX_FORMS, MAX_NAME_LENGTH, splitForms, usualForms, withUsualForms } from './glossary-forms';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

export { usualForms } from './glossary-forms';

/** ?a-completer: the words kept for later only. */
export const TO_COMPLETE_QUERY = 'a-completer';

/**
 * Pastry words (émulsionner, chemiser, blanchir…): explained on the glossary page, and underlined
 * in the recipe steps, with their definition at a tap. Each word is found under its name and under
 * the other spellings given (conjugated verb, plural…). A word kept for later ("À compléter") waits
 * for its definition, and shows nowhere on the site until then.
 */
@Component({
  selector: 'yona-admin-glossary',
  imports: [Icon, RouterLink, BulkBar, Button, Skeleton],
  templateUrl: './admin-glossary.html',
  styleUrl: './admin-glossary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminGlossary {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly glossaryPath = GLOSSARY_PATH;
  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly maxDefinitionLength = MAX_DEFINITION_LENGTH;
  protected readonly terms = resource({ loader: () => this.api.invoke(listAdminGlossary) });
  protected readonly onlyToComplete = signal(inject(ActivatedRoute).snapshot.queryParamMap.has(TO_COMPLETE_QUERY));
  /** Kept for later, waiting for their definition. */
  protected readonly toComplete = computed(() => (this.terms.value() ?? []).filter((term) => !term.definition).length);
  /** In the order of the site's glossary page. */
  protected readonly sortedTerms = computed(() => {
    const terms = this.terms.value();
    return terms && [...terms].filter((term) => !this.onlyToComplete() || !term.definition).sort(byGlossaryName);
  });

  /** The word being changed; null while adding a new one. */
  protected readonly editing = signal<GlossaryTermResponse | null>(null);
  protected readonly name = signal('');
  protected readonly definition = signal('');
  /** Comma-separated, as typed. */
  protected readonly forms = signal('');
  protected readonly saving = signal(false);

  protected readonly selection = new Selection<number>();
  protected readonly termIds = computed(() => this.sortedTerms()?.map((term) => term.id) ?? []);
  protected readonly deleting = signal(false);

  protected edit(term: GlossaryTermResponse): void {
    this.editing.set(term);
    this.name.set(term.name);
    this.definition.set(term.definition ?? '');
    this.forms.set(term.forms.join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancel(): void {
    this.editing.set(null);
    this.name.set('');
    this.definition.set('');
    this.forms.set('');
  }

  /** The usual forms of a verb in -er or -ir, or the plural of a noun, added to those typed. */
  protected suggestForms(): void {
    if (!usualForms(this.name().trim()).length) {
      this.toaster.error("Écrivez d'abord le mot");
      return;
    }
    this.forms.set(withUsualForms(this.forms(), this.name()));
  }

  /** {@code later}: "Garder pour plus tard", without definition. */
  protected async save(event: Event, later = false): Promise<void> {
    event.preventDefault();
    const body = {
      name: this.name().trim(),
      definition: later ? undefined : this.definition().trim(),
      forms: splitForms(this.forms()).slice(0, MAX_FORMS),
    };
    if (!body.name || (!later && !body.definition)) {
      this.toaster.error(later ? 'Écrivez le mot à garder' : 'Donnez le mot et sa définition, ou gardez-le pour plus tard');
      return;
    }
    const editing = this.editing();
    this.saving.set(true);
    const saved = await attempt(
      editing
        ? this.api.invoke(updateGlossaryTerm, { id: editing.id, body })
        : this.api.invoke(createGlossaryTerm, { body }),
    );
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(
        later
          ? `« ${saved.value.name} » gardé pour plus tard, à compléter`
          : editing
            ? `« ${saved.value.name} » modifié`
            : `« ${saved.value.name} » ajouté au glossaire`,
      );
      this.cancel();
      this.terms.reload();
    }
  }

  protected async remove(term: GlossaryTermResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Retirer ce mot du glossaire ?',
      message: `« ${term.name} » ne sera plus expliqué dans les recettes. Il reste 30 jours dans la corbeille, d'où il peut être restauré`,
      confirmLabel: 'Retirer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteGlossaryTerms, { ids: [term.id] }))).ok) {
      this.toaster.success('Mot mis à la corbeille');
      if (this.selection.has(term.id)) {
        this.selection.toggle(term.id);
      }
      if (this.editing()?.id === term.id) {
        this.cancel();
      }
      this.terms.reload();
    }
  }

  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Retirer ${count} mots du glossaire ?` : 'Retirer ce mot du glossaire ?',
      message: 'Ils ne seront plus expliqués dans les recettes. Ils restent 30 jours dans la corbeille',
      confirmLabel: 'Retirer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteGlossaryTerms, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} mots mis à la corbeille` : 'Mot mis à la corbeille');
      this.selection.clear();
      this.cancel();
      this.terms.reload();
    }
  }
}
