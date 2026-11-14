import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { setIngredientNutrition } from '../../../core/api/generated/fn/admin-ingredients/set-ingredient-nutrition';
import { suggestIngredientNutrition } from '../../../core/api/generated/fn/admin-ingredients/suggest-ingredient-nutrition';
import { searchCiqualFoods } from '../../../core/api/generated/fn/admin-nutrition/search-ciqual-foods';
import { searchOpenFoodFacts } from '../../../core/api/generated/fn/admin-nutrition/search-open-food-facts';
import { CiqualFood } from '../../../core/api/generated/models/ciqual-food';
import { IngredientNutritionForm } from '../../../core/api/generated/models/ingredient-nutrition-form';
import { IngredientResponse } from '../../../core/api/generated/models/ingredient-response';
import { NutritionLabel } from '../../../core/api/generated/models/nutrition-label';
import { OpenFoodFactsProduct } from '../../../core/api/generated/models/open-food-facts-product';
import { Toaster } from '../../../core/notifications/toaster';
import { formatGrams, formatKcal } from '../../../shared/format/nutrition';
import { Button } from '../../../shared/ui/button/button';
import { DataSourceLogo } from '../../../shared/ui/data-source-logo/data-source-logo';
import { Icon } from '../../../shared/ui/icon/icon';
import { Segmented } from '../../../shared/ui/segmented/segmented';

type Tab = 'CIQUAL' | 'SHOP' | 'LABEL';

type LabelKey = keyof NutritionLabel;

/** Foods offered for its name, before anything is typed. */
const OFFERED_FOODS = 6;

/** The fields of a label, in its order; the values are typed as on the packet, per 100 g. */
export const LABEL_FIELDS: { key: LabelKey; label: string; unit: string; max: number }[] = [
  { key: 'kcal', label: 'Énergie', unit: 'kcal', max: 950 },
  { key: 'fat', label: 'Matières grasses', unit: 'g', max: 100 },
  { key: 'saturatedFat', label: 'dont acides gras saturés', unit: 'g', max: 100 },
  { key: 'carbohydrates', label: 'Glucides', unit: 'g', max: 100 },
  { key: 'sugars', label: 'dont sucres', unit: 'g', max: 100 },
  { key: 'fibre', label: 'Fibres', unit: 'g', max: 100 },
  { key: 'proteins', label: 'Protéines', unit: 'g', max: 100 },
  { key: 'salt', label: 'Sel', unit: 'g', max: 100 },
];

/** The label typed, or why it cannot be saved. */
export function readLabel(values: Partial<Record<LabelKey, number | null>>): NutritionLabel | string {
  const label: Partial<NutritionLabel> = {};
  for (const field of LABEL_FIELDS) {
    const value = values[field.key];
    if (value == null || !Number.isFinite(value) || value < 0 || value > field.max) {
      return `Indiquez « ${field.label} » pour 100 g, de 0 à ${field.max} ${field.unit}`;
    }
    label[field.key] = Math.round(value * 100) / 100;
  }
  const complete = label as NutritionLabel;
  if (complete.sugars > complete.carbohydrates || complete.saturatedFat > complete.fat) {
    return 'Les sucres ne peuvent pas dépasser les glucides, ni les acides gras saturés les matières grasses';
  }
  return { ...complete, kcal: Math.round(complete.kcal * 10) / 10 };
}

/** "Open Food Facts · Kinder Bueno · Ferrero · 3017626998106". */
export function productSource(product: OpenFoodFactsProduct): string {
  return ['Open Food Facts', product.name, product.brands, product.code].filter(Boolean).join(' · ').slice(0, 300);
}

/**
 * The nutrition facts of an ingredient, in a dialog of "Ingrédients": the Ciqual food it is (searched, or
 * offered), a product of the shops found on Open Food Facts, or the values of its label typed by hand. Saved, the
 * dialog closes ("saved").
 */
@Component({
  selector: 'yona-ingredient-nutrition-editor',
  imports: [Button, DataSourceLogo, Icon, Segmented],
  template: `
    <div class="nutrition">
      <div class="nutrition__current">
        @if (ingredient().nutrition; as nutrition) {
          <p>
            <strong>Actuellement :</strong>
            {{ nutrition.ciqualName ? 'Ciqual · ' + nutrition.ciqualName : 'Étiquette' + (nutrition.labelSource ? ' · ' + nutrition.labelSource : '') }}
            <span class="admin-row__meta">{{ summary(nutrition.per100g) }} pour 100 g</span>
          </p>
          <button yonaButton variant="ghost" type="button" [disabled]="saving()" (click)="remove()">Retirer les valeurs</button>
        } @else {
          <p class="field__hint">
            Pas encore de valeurs : les recettes qui utilisent « {{ ingredient().name }} » le laissent de côté dans leurs valeurs nutritionnelles
          </p>
        }
      </div>

      <div class="segmented" yonaSegmented role="tablist" aria-label="Valeurs nutritionnelles depuis">
        <button type="button" class="segmented__option" role="tab" [attr.aria-selected]="tab() === 'CIQUAL'" (click)="tab.set('CIQUAL')">
          <yona-data-source-logo name="ciqual" [size]="16" />Aliment Ciqual
        </button>
        <button type="button" class="segmented__option" role="tab" [attr.aria-selected]="tab() === 'SHOP'" (click)="tab.set('SHOP')">
          <yona-data-source-logo name="open-food-facts" [size]="16" />Produit du commerce
        </button>
        <button type="button" class="segmented__option" role="tab" [attr.aria-selected]="tab() === 'LABEL'" (click)="tab.set('LABEL')">
          <svg yonaIcon="pencil" [size]="16"></svg>Étiquette
        </button>
      </div>

      @switch (tab()) {
        @case ('CIQUAL') {
          <div class="nutrition__tab" role="tabpanel">
            <input
              type="search"
              class="input"
              placeholder="Chercher un aliment : beurre doux, farine T55…"
              aria-label="Chercher un aliment de la table Ciqual"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
            <p class="field__hint source">
              <yona-data-source-logo name="ciqual" [size]="16" />
              <span>
                Les aliments de base de la table Ciqual de l'Anses. Les plus proches de « {{ ingredient().name }} » sont proposés ;
                tapez un mot pour chercher parmi tous (20 résultats au plus). Nouvelle version de la table : « Mettre à jour Ciqual »,
                en haut de la page Ingrédients
              </span>
            </p>
            <ul role="list" class="foods">
              @for (food of foods(); track food.code) {
                <li class="food">
                  <span class="food__name">
                    <strong>{{ food.name }}</strong>
                    <span class="admin-row__meta">{{ food.subgroupName ?? '' }} · {{ summary(food.per100g) }} pour 100 g</span>
                  </span>
                  <button yonaButton variant="secondary" type="button" [disabled]="saving()" (click)="chooseFood(food)">
                    {{ ingredient().nutrition?.ciqualCode === food.code ? 'Choisi' : 'Choisir' }}
                  </button>
                </li>
              } @empty {
                @if (!searching()) {
                  <li class="admin-row__meta">Aucun aliment trouvé : essayez un autre mot, ou un produit du commerce</li>
                }
              }
            </ul>
          </div>
        }
        @case ('SHOP') {
          <form class="nutrition__tab" role="tabpanel" (submit)="$event.preventDefault(); searchShop()">
            <div class="admin-toolbar">
              <input
                type="search"
                class="input"
                placeholder="Kinder Bueno, spéculoos Lotus, ou 3017626998106"
                aria-label="Nom du produit ou code-barres"
                [value]="shopQuery()"
                (input)="shopQuery.set($any($event.target).value)"
              />
              <button yonaButton type="submit" [disabled]="shopSearching() || !shopQuery().trim()">
                <svg yonaIcon="search"></svg>{{ shopSearching() ? 'Recherche…' : 'Chercher' }}
              </button>
            </div>
            <p class="field__hint source">
              <yona-data-source-logo name="open-food-facts" [size]="16" />
              <span>
                Le nom du produit, ou les chiffres sous le code-barres du paquet (<svg yonaIcon="scan-barcode" [size]="14"></svg>).
                Les valeurs viennent d'Open Food Facts, la base ouverte des produits du commerce : vérifiez-les avant d'enregistrer
              </span>
            </p>
            @if (products(); as products) {
              <ul role="list" class="foods">
                @for (product of products; track product.code) {
                  <li class="food">
                    <span class="food__name">
                      <strong>{{ product.name }}</strong>
                      <span class="admin-row__meta">
                        {{ [product.brands, product.quantity, product.code].filter(isText).join(' · ') }} · {{ formatKcal(product.per100g.kcal) }} pour 100 g
                      </span>
                    </span>
                    <button yonaButton variant="secondary" type="button" (click)="useProduct(product)">Utiliser ces valeurs</button>
                  </li>
                } @empty {
                  <li class="admin-row__meta">Aucun produit trouvé avec ses valeurs : essayez son code-barres, ou saisissez l'étiquette</li>
                }
              </ul>
            }
          </form>
        }
        @case ('LABEL') {
          <form class="nutrition__tab" role="tabpanel" (submit)="$event.preventDefault(); saveLabel()">
            <p class="field__hint">Les valeurs du tableau nutritionnel du paquet, pour 100 g, tapées à la main ou reprises d'un produit du commerce</p>
            <div class="label-fields">
              @for (field of fields; track field.key) {
                <label class="field">
                  <span class="field__label">{{ field.label }} ({{ field.unit }})</span>
                  <input
                    class="input"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    [max]="field.max"
                    step="0.01"
                    [value]="labelValues()[field.key] ?? ''"
                    (input)="setLabel(field.key, $event)"
                  />
                </label>
              }
            </div>
            <label class="field">
              <span class="field__label">Provenance (facultatif)</span>
              <input class="input" maxlength="300" placeholder="Paquet de la marque…" [value]="labelSource()" (input)="labelSource.set($any($event.target).value)" />
            </label>
            <div class="admin-toolbar">
              <button yonaButton type="submit" [disabled]="saving()"><svg yonaIcon="save"></svg>Enregistrer l'étiquette</button>
            </div>
          </form>
        }
      }
    </div>
  `,
  styles: `
    .nutrition,
    .nutrition__tab {
      display: grid;
      gap: var(--space-3);
    }

    .source {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);

      yona-data-source-logo {
        margin-top: 2px;
      }

      svg {
        vertical-align: -2px;
      }
    }

    .nutrition__current {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
    }

    .foods {
      display: grid;
      gap: var(--space-2);
    }

    /* The name on the left, its button on the right, whatever the length of the name */
    .food {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-2) var(--space-4);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-line);
    }

    .food__name {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .label-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: var(--space-3);
    }

    /* A label on two lines leaves its field at the bottom, level with those of its row */
    .label-fields .field {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: var(--space-1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientNutritionEditor {
  readonly ingredient = input.required<IngredientResponse>();
  /** Saved: the ingredient as it is now. */
  readonly saved = output<IngredientResponse>();

  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  protected readonly fields = LABEL_FIELDS;
  protected readonly formatKcal = formatKcal;
  protected readonly isText = (value: string | undefined): value is string => !!value;

  /** A label first when it has one, Ciqual otherwise. */
  protected readonly tab = linkedSignal<Tab>(() => (this.ingredient().nutrition?.label ? 'LABEL' : 'CIQUAL'));
  protected readonly saving = signal(false);

  // Ciqual: what is typed, or the foods offered for its name while nothing is.
  protected readonly query = signal('');
  private readonly debouncedQuery = toSignal(toObservable(this.query).pipe(debounceTime(300)), { initialValue: '' });
  private readonly found = resource({
    params: () => {
      const q = this.debouncedQuery().trim();
      return q ? { q: q.slice(0, 100) } : undefined;
    },
    loader: ({ params }) => this.api.invoke(searchCiqualFoods, params),
  });
  private readonly offered = resource({
    params: () => ({ name: [this.ingredient().name], limit: OFFERED_FOODS }),
    loader: ({ params }) => this.api.invoke(suggestIngredientNutrition, params),
  });
  protected readonly foods = computed<CiqualFood[]>(() =>
    this.debouncedQuery().trim() ? (this.found.value() ?? []) : (this.offered.value()?.[0]?.foods ?? []),
  );
  protected readonly searching = computed(() => this.found.isLoading() || this.offered.isLoading());

  // Open Food Facts: asked on "Chercher" only, a service of its own.
  protected readonly shopQuery = linkedSignal(() => this.ingredient().name);
  protected readonly shopSearching = signal(false);
  protected readonly products = signal<OpenFoodFactsProduct[] | null>(null);

  // The label: the one saved, or the values of a product chosen
  protected readonly labelValues = linkedSignal<Partial<Record<LabelKey, number | null>>>(() => ({
    ...(this.ingredient().nutrition?.label ?? {}),
  }));
  protected readonly labelSource = linkedSignal(() => this.ingredient().nutrition?.labelSource ?? '');

  /** "753 kcal · protéines 0,6 g · glucides 0,7 g · lipides 83 g". */
  protected summary(facts: { kcal: number; proteins: number; carbohydrates: number; fat: number }): string {
    return `${formatKcal(facts.kcal)} · protéines ${formatGrams(facts.proteins)} · glucides ${formatGrams(facts.carbohydrates)} · lipides ${formatGrams(facts.fat)}`;
  }

  protected setLabel(key: LabelKey, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.labelValues.update((values) => ({ ...values, [key]: Number.isFinite(value) ? value : null }));
  }

  protected chooseFood(food: CiqualFood): Promise<void> {
    return this.save({ ciqualCode: food.code }, `« ${this.ingredient().name} » est désormais « ${food.name} »`);
  }

  protected async searchShop(): Promise<void> {
    const q = this.shopQuery().trim().slice(0, 100);
    if (!q) {
      return;
    }
    this.shopSearching.set(true);
    const found = await attempt(this.api.invoke(searchOpenFoodFacts, { q }));
    this.shopSearching.set(false);
    this.products.set(found.ok ? found.value : null);
  }

  /** Copied into the label, to check before saving. */
  protected useProduct(product: OpenFoodFactsProduct): void {
    this.labelValues.set({ ...product.per100g });
    this.labelSource.set(productSource(product));
    this.tab.set('LABEL');
    this.toaster.success('Valeurs reprises : vérifiez-les, puis enregistrez');
  }

  protected saveLabel(): Promise<void> {
    const label = readLabel(this.labelValues());
    if (typeof label === 'string') {
      this.toaster.error(label);
      return Promise.resolve();
    }
    const source = this.labelSource().trim();
    return this.save({ label, labelSource: source || undefined }, 'Étiquette enregistrée');
  }

  protected remove(): Promise<void> {
    return this.save({}, 'Valeurs nutritionnelles retirées');
  }

  private async save(body: IngredientNutritionForm, message: string): Promise<void> {
    this.saving.set(true);
    const saved = await attempt(this.api.invoke(setIngredientNutrition, { id: this.ingredient().id, body }));
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(message);
      this.saved.emit(saved.value);
    }
  }
}
