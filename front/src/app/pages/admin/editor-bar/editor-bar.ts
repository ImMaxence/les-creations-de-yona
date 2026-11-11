import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * The bar at the bottom of an editor of the back-office (a recipe, an article), always at hand:
 * "Retour à la liste", then "Aperçu" and the saving buttons; a draft is saved as it is, or published.
 * What is put inside goes before "Aperçu" (a button to the trash). With `submits`, saving submits the
 * form around it (its checks run first) instead of sending `save`.
 */
@Component({
  selector: 'yona-editor-bar',
  imports: [Button, Icon, RouterLink],
  template: `
    <!-- Phones: "Retour" and the preview's icon, so that the actions hold on one line -->
    <a yonaButton variant="ghost" class="back" [routerLink]="back()">
      <svg yonaIcon="arrow-left"></svg><span class="narrow">Retour</span><span class="wide">Retour à la liste</span>
    </a>
    <div class="actions" [class.has-publish]="draft()">
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
        <button yonaButton type="button" [disabled]="saving()" (click)="publish.emit()"><svg yonaIcon="send"></svg>Publier</button>
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

  readonly save = output();
  readonly publish = output();
  readonly preview = output();

  protected onSave(): void {
    if (!this.submits()) {
      this.save.emit();
    }
  }
}
