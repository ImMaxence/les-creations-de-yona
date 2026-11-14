import { ChangeDetectionStrategy, Component, inject, output, resource, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { getCiqualTable } from '../../../core/api/generated/fn/admin-nutrition/get-ciqual-table';
import { importCiqualTable } from '../../../core/api/generated/fn/admin-nutrition/import-ciqual-table';
import { CiqualImport } from '../../../core/api/generated/models/ciqual-import';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { parisDateTime } from '../../../shared/format/paris-time';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/** Where the Anses publishes the table: the Excel file is to be downloaded there. */
export const CIQUAL_DOWNLOAD = 'https://ciqual.anses.fr/';

/**
 * "Table Ciqual": the version the site uses, and the import of a new one, in the Excel file of the Anses. The
 * ingredients keep their food (same code); those whose food is gone are named, to be linked again.
 */
@Component({
  selector: 'yona-ciqual-table',
  imports: [Button, Icon],
  template: `
    <section class="admin-panel ciqual" aria-labelledby="ciqual-title">
      <div class="ciqual__head">
        <h3 id="ciqual-title">Table Ciqual</h3>
        <button type="button" class="icon-button" aria-label="Fermer la table Ciqual" (click)="closed.emit()"><svg yonaIcon="x" [size]="18"></svg></button>
      </div>
      @if (table.value(); as table) {
        <p>
          <strong>{{ table.version }}</strong>, {{ table.foodCount.toLocaleString('fr-FR') }} aliments
          <span class="admin-row__meta">
            {{ table.importedBy === 'migration' ? 'installée avec le site' : 'importée le ' + day(table.importedAt) + ' par ' + table.importedBy }}
          </span>
        </p>
      }
      <p class="field__hint">
        Les valeurs nutritionnelles des aliments de base, publiées par l'Anses (Licence Ouverte). Quand une nouvelle version sort,
        téléchargez le fichier Excel (.xlsx) sur
        <a [href]="download" target="_blank" rel="noopener noreferrer">ciqual.anses.fr</a>, puis importez-le ici : les ingrédients
        gardent leur aliment, les recettes suivent les nouvelles valeurs
      </p>
      <div class="admin-toolbar">
        <input #fileInput type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden (change)="pick($event)" />
        <button yonaButton variant="secondary" type="button" [disabled]="importing()" (click)="fileInput.click()">
          <svg yonaIcon="upload"></svg>{{ importing() ? 'Import en cours…' : 'Importer une nouvelle version' }}
        </button>
      </div>
      @if (result(); as result) {
        <div class="ciqual__result" role="status">
          <p>
            <svg yonaIcon="circle-check" [size]="18"></svg>
            {{ result.version }} : {{ result.foodCount.toLocaleString('fr-FR') }} aliments, {{ result.added }} ajouté{{ result.added > 1 ? 's' : '' }},
            {{ result.removed }} retiré{{ result.removed > 1 ? 's' : '' }}
          </p>
          @if (result.unlinkedIngredients.length) {
            <p class="field__hint">
              À lier de nouveau, leur aliment n'est plus dans la table : {{ result.unlinkedIngredients.join(', ') }}
            </p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .ciqual {
      display: grid;
      gap: var(--space-3);
    }

    .ciqual__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ciqual__result p:first-child {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CiqualTable {
  /** A new version is in: the ingredients may have changed. */
  readonly imported = output<void>();
  readonly closed = output<void>();

  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly download = CIQUAL_DOWNLOAD;
  protected readonly table = resource({ loader: () => this.api.invoke(getCiqualTable) });
  protected readonly importing = signal(false);
  protected readonly result = signal<CiqualImport | null>(null);

  protected day(instant: string): string {
    return parisDateTime(instant);
  }

  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: 'Importer cette table Ciqual ?',
      message: `« ${file.name} » remplace la table du site. Les ingrédients gardent leur aliment, et les recettes suivent les nouvelles valeurs`,
      confirmLabel: 'Importer',
    });
    if (!confirmed) {
      return;
    }
    this.importing.set(true);
    const done = await attempt(this.api.invoke(importCiqualTable, { body: { file } }));
    this.importing.set(false);
    if (done.ok) {
      this.result.set(done.value);
      this.toaster.success(`Table ${done.value.version} importée`);
      this.table.reload();
      this.imported.emit();
    }
  }
}
