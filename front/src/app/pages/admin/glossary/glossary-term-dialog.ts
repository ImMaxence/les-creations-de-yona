import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { createGlossaryTerm } from '../../../core/api/generated/fn/admin-glossary/create-glossary-term';
import { updateGlossaryTerm } from '../../../core/api/generated/fn/admin-glossary/update-glossary-term';
import { GlossaryTermResponse } from '../../../core/api/generated/models/glossary-term-response';
import { Toaster } from '../../../core/notifications/toaster';
import { glossaryKey } from '../../../shared/format/glossary';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { MAX_DEFINITION_LENGTH, MAX_FORMS, MAX_NAME_LENGTH, splitForms, usualForms, withUsualForms } from './glossary-forms';

/**
 * A word added to the glossary without leaving the recipe: a window over the editor, the word
 * selected in a step already written. "Garder pour plus tard" keeps it without definition (it shows
 * nowhere on the site until it has one). A word already in the glossary is completed instead.
 */
@Component({
  selector: 'yona-glossary-term-dialog',
  imports: [Button, Dialog, Icon],
  template: `
    <yona-dialog title="Ajouter au glossaire" [subtitle]="existing() ? 'Ce mot est déjà dans le glossaire : complétez-le' : undefined" [(open)]="open">
      <form id="glossary-term-form" class="term" (submit)="save($event)">
        <div class="field">
          <label class="field__label" for="dialog-term-name">Mot</label>
          <input id="dialog-term-name" class="input" placeholder="Chemiser" [maxLength]="maxNameLength" [value]="name()" (input)="rename($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="dialog-term-definition">Définition</label>
          <textarea
            id="dialog-term-definition"
            class="input"
            rows="3"
            placeholder="Garnir l'intérieur d'un moule de papier cuisson, ou de beurre et de farine, pour que la préparation n'attache pas"
            [maxLength]="maxDefinitionLength"
            [value]="definition()"
            (input)="definition.set($any($event.target).value)"
          ></textarea>
        </div>
        <div class="field">
          <label class="field__label" for="dialog-term-forms">Autres formes dans les étapes (facultatif)</label>
          <input id="dialog-term-forms" class="input" placeholder="chemisez, chemisé, chemisée" [value]="forms()" (input)="forms.set($any($event.target).value)" />
          <span class="field__hint">
            Séparées par des virgules
            <button type="button" class="link-button" (click)="suggestForms()"><svg yonaIcon="sparkles" [size]="14"></svg>Proposer les formes courantes</button>
          </span>
        </div>
      </form>
      <ng-container dialogActions>
        @if (!existing()?.definition) {
          <button yonaButton variant="ghost" type="button" [disabled]="saving()" (click)="save($event, true)"><svg yonaIcon="hourglass"></svg>Garder pour plus tard</button>
        }
        <button yonaButton type="submit" form="glossary-term-form" [disabled]="saving()"><svg yonaIcon="save"></svg>Enregistrer</button>
      </ng-container>
    </yona-dialog>
  `,
  styles: `
    .term {
      display: grid;
      gap: var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryTermDialog {
  readonly open = model(false);
  /** The words already in the glossary, those kept for later included. */
  readonly terms = input<GlossaryTermResponse[]>([]);
  readonly saved = output<GlossaryTermResponse>();

  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly maxDefinitionLength = MAX_DEFINITION_LENGTH;
  protected readonly name = signal('');
  protected readonly definition = signal('');
  protected readonly forms = signal('');
  /** The word typed, when the glossary already has it. */
  protected readonly existing = signal<GlossaryTermResponse | null>(null);
  protected readonly saving = signal(false);

  /** {@code word}: the words selected in a step; empty from the "Glossaire" button. */
  start(word = ''): void {
    this.definition.set('');
    this.forms.set('');
    this.rename(word.trim().slice(0, MAX_NAME_LENGTH));
    this.open.set(true);
  }

  protected rename(name: string): void {
    this.name.set(name);
    const key = glossaryKey(name);
    const existing = key ? (this.terms().find((term) => [term.name, ...term.forms].some((form) => glossaryKey(form) === key)) ?? null) : null;
    if (existing && existing.id !== this.existing()?.id) {
      this.definition.set(existing.definition ?? '');
      this.forms.set(existing.forms.join(', '));
    }
    this.existing.set(existing);
  }

  protected suggestForms(): void {
    if (!usualForms(this.name().trim()).length) {
      this.toaster.error("Écrivez d'abord le mot");
      return;
    }
    this.forms.set(withUsualForms(this.forms(), this.name()));
  }

  protected async save(event: Event, later = false): Promise<void> {
    event.preventDefault();
    const existing = this.existing();
    const body = {
      name: existing?.name ?? this.name().trim(),
      definition: later ? undefined : this.definition().trim(),
      forms: splitForms(this.forms()).slice(0, MAX_FORMS),
    };
    if (!body.name || (!later && !body.definition)) {
      this.toaster.error(later ? 'Écrivez le mot à garder' : 'Écrivez sa définition, ou gardez-le pour plus tard');
      return;
    }
    this.saving.set(true);
    const saved = await attempt(
      existing ? this.api.invoke(updateGlossaryTerm, { id: existing.id, body }) : this.api.invoke(createGlossaryTerm, { body }),
    );
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(later ? `« ${saved.value.name} » gardé pour plus tard, à compléter` : `« ${saved.value.name} » est dans le glossaire`);
      this.open.set(false);
      this.saved.emit(saved.value);
    }
  }
}
