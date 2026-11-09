import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { createShopProduct } from '../../../core/api/generated/fn/admin-shop/create-shop-product';
import { deleteShopProduct } from '../../../core/api/generated/fn/admin-shop/delete-shop-product';
import { getShopSettings } from '../../../core/api/generated/fn/admin-shop/get-shop-settings';
import { listShopProducts } from '../../../core/api/generated/fn/admin-shop/list-shop-products';
import { updateShopProduct } from '../../../core/api/generated/fn/admin-shop/update-shop-product';
import { updateShopSettings } from '../../../core/api/generated/fn/admin-shop/update-shop-settings';
import { AdminShopProduct } from '../../../core/api/generated/models/admin-shop-product';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { formatEuros } from '../../../shared/format/units';
import { SHOP_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { Select, SelectOption } from '../../../shared/ui/select/select';

/** What the shop says and sells: open or closed, its texts, and the recipes offered with their price. */
@Component({
  selector: 'yona-admin-products',
  imports: [Button, Icon, RouterLink, Select],
  template: `
    <section class="admin-section" aria-labelledby="products-title">
      <div class="admin-section__head">
        <h2 id="products-title">Produits</h2>
        <a yonaButton variant="ghost" target="_blank" [routerLink]="shopPath"><svg yonaIcon="external-link"></svg>Voir sur le site</a>
      </div>

      <form class="admin-panel" (submit)="saveSettings($event)">
        <label class="checkbox-field">
          <input type="checkbox" [checked]="open()" (change)="open.set($any($event.target).checked)" />
          Boutique ouverte
        </label>
        <span class="field__hint">Fermée, la boutique n'apparaît plus dans le menu et ne prend plus de commande</span>
        <div class="field">
          <label class="field__label" for="shop-intro">Présentation</label>
          <textarea id="shop-intro" class="input" rows="3" maxlength="1000" [value]="intro()" (input)="intro.set($any($event.target).value)"></textarea>
        </div>
        <div class="field">
          <label class="field__label" for="shop-pickup">Retrait (facultatif)</label>
          <textarea id="shop-pickup" class="input" rows="2" maxlength="1000" placeholder="Où et quand venir chercher sa commande" [value]="pickup()" (input)="pickup.set($any($event.target).value)"></textarea>
        </div>
        <button yonaButton type="submit" [disabled]="savingSettings()"><svg yonaIcon="save"></svg>Enregistrer</button>
      </form>

      <form class="admin-panel" (submit)="saveProduct($event)">
        <h3>{{ editing() ? 'Modifier « ' + editing()!.recipeTitle + ' »' : 'Ajouter une recette à la boutique' }}</h3>
        @if (!editing()) {
          <div class="field">
            <span class="field__label">Recette</span>
            <yona-select label="Recette" placeholder="Choisir une recette…" [options]="recipeOptions()" [value]="recipeId()" (valueChange)="recipeId.set($event ?? null)" />
          </div>
        }
        <div class="field">
          <label class="field__label" for="product-price">Prix (€)</label>
          <input id="product-price" class="input" type="number" inputmode="decimal" min="0" step="0.01" [value]="price()" (input)="price.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="product-portions">Portions (facultatif)</label>
          <input id="product-portions" class="input" maxlength="100" placeholder="Pour 8 personnes" [value]="portionLabel()" (input)="portionLabel.set($any($event.target).value)" />
        </div>
        <label class="checkbox-field">
          <input type="checkbox" [checked]="available()" (change)="available.set($any($event.target).checked)" />
          Disponible à la commande
        </label>
        <div class="admin-toolbar">
          <button yonaButton type="submit" [disabled]="savingProduct()"><svg yonaIcon="save"></svg>{{ editing() ? 'Enregistrer' : 'Ajouter' }}</button>
          @if (editing()) {
            <button yonaButton variant="ghost" type="button" (click)="cancel()">Annuler</button>
          }
        </div>
      </form>

      @if (products.value(); as list) {
        @if (list.length) {
          <ul role="list" class="admin-list">
            @for (product of list; track product.id) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <span class="admin-row__title">{{ product.recipeTitle }}</span>
                  <span class="admin-row__meta">
                    {{ formatEuros(product.price) }}
                    @if (product.portionLabel; as portions) {
                      · {{ portions }}
                    }
                    @if (!product.available) {
                      <span class="badge badge--draft">Indisponible</span>
                    }
                    @if (product.recipeStatus !== 'PUBLISHED') {
                      <span class="badge badge--failed">Recette non publiée</span>
                    }
                  </span>
                </span>
                <div class="admin-row__actions">
                  <button type="button" class="icon-button" [attr.aria-label]="'Modifier ' + product.recipeTitle" (click)="edit(product)"><svg yonaIcon="pencil" [size]="18"></svg></button>
                  <button type="button" class="icon-button icon-button--danger" [attr.aria-label]="'Retirer ' + product.recipeTitle" (click)="remove(product)"><svg yonaIcon="trash" [size]="18"></svg></button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="admin-empty">Aucune recette dans la boutique pour le moment</p>
        }
      }
    </section>
  `,
  styles: `
    h3 {
      font-size: var(--text-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminProducts {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly shopPath = SHOP_PATH;
  protected readonly formatEuros = formatEuros;

  private readonly settings = resource({ loader: () => this.api.invoke(getShopSettings) });
  protected readonly open = signal(false);
  protected readonly intro = signal('');
  protected readonly pickup = signal('');
  protected readonly savingSettings = signal(false);

  protected readonly products = resource({ loader: () => this.api.invoke(listShopProducts) });
  private readonly recipes = resource({ loader: () => this.loadRecipes() });
  /** Those not in the shop yet; drafts marked as such. */
  protected readonly recipeOptions = computed<SelectOption<number>[]>(() => {
    const inShop = new Set(this.products.value()?.map((product) => product.recipeId));
    return (this.recipes.value() ?? [])
      .filter((recipe) => !inShop.has(recipe.id))
      .map((recipe) => ({ value: recipe.id, label: recipe.status === 'PUBLISHED' ? recipe.title : `${recipe.title} (non publiée)` }));
  });

  /** The product being changed; null while adding a new one. */
  protected readonly editing = signal<AdminShopProduct | null>(null);
  protected readonly recipeId = signal<number | null>(null);
  /** As typed in the field. */
  protected readonly price = signal('');
  protected readonly portionLabel = signal('');
  protected readonly available = signal(true);
  protected readonly savingProduct = signal(false);

  constructor() {
    effect(() => {
      const settings = this.settings.value();
      if (settings) {
        this.open.set(settings.ordersOpen);
        this.intro.set(settings.intro);
        this.pickup.set(settings.pickupInfo ?? '');
      }
    });
  }

  protected async saveSettings(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.intro().trim()) {
      this.toaster.error('Écrivez une présentation pour la boutique');
      return;
    }
    this.savingSettings.set(true);
    const saved = await attempt(
      this.api.invoke(updateShopSettings, {
        body: { ordersOpen: this.open(), intro: this.intro().trim(), pickupInfo: this.pickup().trim() || undefined },
      }),
    );
    this.savingSettings.set(false);
    if (saved.ok) {
      this.toaster.success(saved.value.ordersOpen ? 'Boutique ouverte' : 'Boutique fermée');
      void this.siteData.load();
    }
  }

  protected edit(product: AdminShopProduct): void {
    this.editing.set(product);
    this.price.set(String(product.price));
    this.portionLabel.set(product.portionLabel ?? '');
    this.available.set(product.available);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.recipeId.set(null);
    this.price.set('');
    this.portionLabel.set('');
    this.available.set(true);
  }

  protected async saveProduct(event: Event): Promise<void> {
    event.preventDefault();
    const price = Number(this.price());
    const editing = this.editing();
    const recipeId = editing?.recipeId ?? this.recipeId();
    if (recipeId === null || this.price().trim() === '' || !Number.isFinite(price) || price < 0) {
      this.toaster.error('Choisissez une recette et indiquez son prix');
      return;
    }
    const body = { recipeId, price, portionLabel: this.portionLabel().trim() || undefined, available: this.available() };
    this.savingProduct.set(true);
    const saved = await attempt(
      editing ? this.api.invoke(updateShopProduct, { id: editing.id, body }) : this.api.invoke(createShopProduct, { body }),
    );
    this.savingProduct.set(false);
    if (saved.ok) {
      this.toaster.success(editing ? 'Produit enregistré' : 'Recette ajoutée à la boutique');
      this.cancel();
      this.products.reload();
    }
  }

  protected async remove(product: AdminShopProduct): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Retirer cette recette de la boutique ?',
      message: `« ${product.recipeTitle} » reste sur le blog, et les commandes déjà passées la gardent`,
      confirmLabel: 'Retirer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteShopProduct, { id: product.id }))).ok) {
      this.toaster.success('Recette retirée de la boutique');
      if (this.editing()?.id === product.id) {
        this.cancel();
      }
      this.products.reload();
    }
  }

  private async loadRecipes(): Promise<RecipeAdminSummary[]> {
    const recipes: RecipeAdminSummary[] = [];
    for (let page = 0, totalPages = 1; page < totalPages; page++) {
      const result = await this.api.invoke(searchRecipes, { page, size: 50, sort: ['title,asc'] });
      recipes.push(...result.content);
      totalPages = result.totalPages;
    }
    return recipes;
  }
}
