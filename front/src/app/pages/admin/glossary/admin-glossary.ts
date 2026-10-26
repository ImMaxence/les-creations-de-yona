import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { createGlossaryTerm } from '../../../core/api/generated/fn/admin-glossary/create-glossary-term';
import { deleteGlossaryTerms } from '../../../core/api/generated/fn/admin-glossary/delete-glossary-terms';
import { updateGlossaryTerm } from '../../../core/api/generated/fn/admin-glossary/update-glossary-term';
import { listGlossary } from '../../../core/api/generated/fn/glossary/list-glossary';
import { GlossaryTermResponse } from '../../../core/api/generated/models/glossary-term-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { GLOSSARY_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { Selection } from '../selection';

const MAX_NAME_LENGTH = 60;
const MAX_DEFINITION_LENGTH = 600;
const MAX_FORMS = 20;

/**
 * Pastry words (émulsionner, chemiser, blanchir…): explained on the glossary page, and underlined
 * in the recipe steps, with their definition at a tap. Each word is found under its name and under
 * the other spellings given (conjugated verb, plural…).
 */
@Component({
  selector: 'yona-admin-glossary',
  imports: [Icon, RouterLink, BulkBar, Button],
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
  protected readonly terms = resource({ loader: () => this.api.invoke(listGlossary) });

  /** The word being changed; null while adding a new one. */
  protected readonly editing = signal<GlossaryTermResponse | null>(null);
  protected readonly name = signal('');
  protected readonly definition = signal('');
  /** Comma-separated, as typed. */
  protected readonly forms = signal('');
  protected readonly saving = signal(false);

  protected readonly selection = new Selection<number>();
  protected readonly termIds = computed(() => this.terms.value()?.map((term) => term.id) ?? []);
  protected readonly deleting = signal(false);

  protected edit(term: GlossaryTermResponse): void {
    this.editing.set(term);
    this.name.set(term.name);
    this.definition.set(term.definition);
    this.forms.set(term.forms.join(', '));
  }

  protected cancel(): void {
    this.editing.set(null);
    this.name.set('');
    this.definition.set('');
    this.forms.set('');
  }

  /** The usual forms of a verb in -er or -ir, or the plural of a noun, added to those typed. */
  protected suggestForms(): void {
    const suggested = usualForms(this.name().trim());
    if (!suggested.length) {
      this.toaster.error("Écrivez d'abord le mot.");
      return;
    }
    const typed = splitForms(this.forms());
    this.forms.set([...new Set([...typed, ...suggested])].join(', '));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const body = {
      name: this.name().trim(),
      definition: this.definition().trim(),
      forms: splitForms(this.forms()).slice(0, MAX_FORMS),
    };
    if (!body.name || !body.definition) {
      this.toaster.error('Donnez le mot et sa définition.');
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
      this.toaster.success(editing ? `« ${saved.value.name} » modifié.` : `« ${saved.value.name} » ajouté au glossaire.`);
      this.cancel();
      this.terms.reload();
    }
  }

  protected async remove(term: GlossaryTermResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Retirer ce mot du glossaire ?',
      message: `« ${term.name} » ne sera plus expliqué dans les recettes.`,
      confirmLabel: 'Retirer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteGlossaryTerms, { ids: [term.id] }))).ok) {
      this.toaster.success('Mot retiré du glossaire.');
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
      message: 'Ils ne seront plus expliqués dans les recettes.',
      confirmLabel: 'Retirer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteGlossaryTerms, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} mots retirés.` : 'Mot retiré.');
      this.selection.clear();
      this.cancel();
      this.terms.reload();
    }
  }
}

function splitForms(text: string): string[] {
  return text
    .split(',')
    .map((form) => form.trim())
    .filter(Boolean);
}

/**
 * "chemiser" → chemisez, chemisé, chemisée, chemisés, chemisées, chemisant; "blanchir" →
 * blanchissez, blanchi…; "ganache" → ganaches. The bare stem ("chemise") is left out: it is often
 * another word.
 */
export function usualForms(word: string): string[] {
  const lower = word.toLocaleLowerCase('fr');
  if (!lower || lower.includes(' ')) {
    return [];
  }
  if (lower.endsWith('er') && lower.length > 3) {
    const stem = lower.slice(0, -2);
    return ['ez', 'é', 'ée', 'és', 'ées', 'ant'].map((ending) => stem + ending);
  }
  if (lower.endsWith('ir') && lower.length > 3) {
    const stem = lower.slice(0, -2);
    return ['issez', 'i', 'ie', 'is', 'ies', 'issant'].map((ending) => stem + ending);
  }
  return /[sxz]$/.test(lower) ? [] : [lower + 's'];
}
