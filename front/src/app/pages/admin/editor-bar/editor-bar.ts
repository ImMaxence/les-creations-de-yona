import { ChangeDetectionStrategy, Component, Signal, booleanAttribute, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/** What "Annuler" and "Rétablir" act on (EditHistory). */
export interface Undoable {
  readonly canUndo: Signal<boolean>;
  readonly canRedo: Signal<boolean>;
  undo(): void;
  redo(): void;
}

/** "⌘Z" on a Mac, "Ctrl+Z" elsewhere. */
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * The bar at the bottom of an editor of the back-office (a recipe, an article), always at hand:
 * "Retour à la liste", "Annuler" and "Rétablir" when given a history, then "Aperçu" and the saving
 * buttons; a draft is saved as it is, or published. What is put inside goes before "Aperçu" (a
 * button to the trash). With `submits`, saving submits the form around it (its checks run first)
 * instead of sending `save`.
 */
@Component({
  selector: 'yona-editor-bar',
  imports: [Button, Icon, RouterLink],
  template: `
    <!-- Phones: "Retour" and the preview's icon, so that the actions hold on one line -->
    <a yonaButton variant="ghost" class="back" [class.is-short]="!!history()" [routerLink]="back()" aria-label="Retour à la liste">
      <svg yonaIcon="arrow-left"></svg><span class="narrow">Retour</span><span class="wide">Retour à la liste</span>
    </a>
    <div class="actions" [class.has-publish]="draft()">
      @if (history(); as history) {
        <div class="history" role="group" aria-label="Historique des modifications">
          <button type="button" class="icon-button" [attr.aria-label]="undoLabel" [disabled]="!history.canUndo()" (click)="history.undo()">
            <svg yonaIcon="undo-2" [size]="18"></svg>
          </button>
          <button type="button" class="icon-button redo" [attr.aria-label]="redoLabel" [disabled]="!history.canRedo()" (click)="history.redo()">
            <svg yonaIcon="redo-2" [size]="18"></svg>
          </button>
        </div>
      }
      <ng-content />
      <button yonaButton variant="secondary" type="button" class="preview" aria-label="Aperçu" [disabled]="previewing()" (click)="preview.emit()">
        <svg yonaIcon="eye"></svg><span class="wide">Aperçu</span>
      </button>
      @if (draft()) {
        <button yonaButton variant="secondary" class="save-draft" [type]="submits() ? 'submit' : 'button'" [disabled]="saving()" (click)="onSave()">
          @if (saving()) {
            Enregistrement…
          } @else {
            <span class="narrow">Enregistrer</span><span class="wide">Enregistrer le brouillon</span>
          }
        </button>
        <button yonaButton type="button" class="publish" [disabled]="saving()" (click)="publish.emit()"><svg yonaIcon="send"></svg>Publier</button>
      } @else {
        <button yonaButton [type]="submits() ? 'submit' : 'button'" [disabled]="saving()" (click)="onSave()">
          {{ saving() ? 'Enregistrement…' : saveLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      position: sticky;
      bottom: var(--space-3);
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-pill);
      background-color: color-mix(in srgb, var(--color-bg) 90%, transparent);
      box-shadow: var(--shadow-md), 0 0 0 1px var(--color-line);
      backdrop-filter: blur(10px);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .back {
      flex: none;
    }

    .history {
      display: flex;
      align-items: center;
    }

    // The narrowest phones: "Rétablir" gives its room to the others
    @media (max-width: 24rem) {
      .redo {
        display: none;
      }
    }

    // Phones: shorter labels, so that the actions of the bar hold on one line
    .wide {
      @include m.below(sm) {
        display: none;
      }
    }

    .narrow {
      @include m.from(sm) {
        display: none;
      }
    }

    @include m.below(sm) {
      :host {
        gap: var(--space-2);
        padding-inline: var(--space-2);
      }

      .back,
      .preview,
      .save-draft {
        padding-inline: var(--space-3);
      }

      // "Annuler" and "Rétablir" take the room of the word "Retour"
      .back.is-short {
        padding-inline: var(--space-2);

        .narrow {
          display: none;
        }
      }

      .actions {
        gap: var(--space-1);
      }

      .publish svg {
        display: none;
      }

      .history .icon-button {
        width: 2.25rem;
        height: 2.25rem;
      }

      // Four actions do not hold on one line: "Aperçu" is also at the top of the page
      .has-publish .preview {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorBar {
  /** The list of the editor: "/admin/recettes". */
  readonly back = input.required<string>();
  /** Not published yet: "Enregistrer le brouillon" and "Publier". */
  readonly draft = input(false, { transform: booleanAttribute });
  readonly saving = input(false, { transform: booleanAttribute });
  readonly previewing = input(false, { transform: booleanAttribute });
  /** Once published: "Enregistrer", "Créer la recette"… */
  readonly saveLabel = input('Enregistrer');
  /** Saving submits the form around the bar. */
  readonly submits = input(false, { transform: booleanAttribute });
  /** "Annuler" and "Rétablir", with the keys of the editor. */
  readonly history = input<Undoable | null>(null);

  protected readonly undoLabel = MAC ? 'Annuler (⌘Z)' : 'Annuler (Ctrl+Z)';
  protected readonly redoLabel = MAC ? 'Rétablir (⌘⇧Z)' : 'Rétablir (Ctrl+Y)';

  readonly save = output();
  readonly publish = output();
  readonly preview = output();

  protected onSave(): void {
    if (!this.submits()) {
      this.save.emit();
    }
  }
}
