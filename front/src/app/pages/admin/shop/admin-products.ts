import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { uploadImage } from '../../../core/api/generated/fn/admin-images/upload-image';
import { createShopProduct } from '../../../core/api/generated/fn/admin-shop/create-shop-product';
import { deleteShopProduct } from '../../../core/api/generated/fn/admin-shop/delete-shop-product';
import { getShopSettings } from '../../../core/api/generated/fn/admin-shop/get-shop-settings';
import { listShopProducts } from '../../../core/api/generated/fn/admin-shop/list-shop-products';
import { updateShopProduct } from '../../../core/api/generated/fn/admin-shop/update-shop-product';
import { updateShopSettings } from '../../../core/api/generated/fn/admin-shop/update-shop-settings';
import { listCategories } from '../../../core/api/generated/fn/categories/list-categories';
import { AdminShopProduct } from '../../../core/api/generated/models/admin-shop-product';
import { AdminShopSettings } from '../../../core/api/generated/models/admin-shop-settings';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ShopProductForm } from '../../../core/api/generated/models/shop-product-form';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { formatEuros } from '../../../shared/format/units';
import { SHOP_PATH } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Icon } from '../../../shared/ui/icon/icon';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { ChosenRecipe, RecipeSearch } from '../recipe-search/recipe-search';

type ShopMode = AdminShopSettings['mode'];

/** The three positions of the shop, and what each changes. */
export const SHOP_MODES: readonly { value: ShopMode; label: string; hint: string }[] = [
  { value: 'CLOSED', label: 'Fermée', hint: 'La boutique n’apparaît nulle part et ne prend aucune demande' },
  {
    value: 'FRIENDS',
    label: 'Proches',
    hint: 'Bandeau « réservée à mes proches », hors du menu principal, cachée de Google, accessible par son lien',
  },
  {
    value: 'OPEN',
    label: 'Ouverte',
    hint: 'Dans le menu et sur l’accueil, sans bandeau, visible par Google. Une fois l’activité en règle : allergènes, conservation, délais, CGV et mention de TVA à prévoir',
  },
];

/** What the shop says and sells: its position, its texts, and its products with their format and price. */
@Component({
  selector: 'yona-admin-products',
  imports: [Button, CoverImage, Icon, ImageUpload, RecipeSearch, RouterLink, Select, Skeleton],
  templateUrl: './admin-products.html',
  styles: `
    h3 {
      font-size: var(--text-lg);
    }

    fieldset.field {
      margin: 0;
      padding: 0;
      border: 0;
    }

    .modes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
      gap: var(--space-2);
    }

    .mode {
      display: grid;
      align-content: start;
      position: relative;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border: 2px solid var(--color-line);
      border-radius: var(--radius-md);
      background-color: var(--color-bg);
      cursor: pointer;

      input {
        position: absolute;
        opacity: 0;
      }

      &:has(input:checked) {
        border-color: var(--color-accent);
      }

      &:has(input:focus-visible) {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
      }
    }

    .mode__label {
      font-weight: 700;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
      gap: var(--space-3);
    }

    .format {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-4);
    }

    .format__batch {
      width: 6rem;
    }

    .product-row__price {
      font-variant-numeric: tabular-nums;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminProducts {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly shopPath = SHOP_PATH;
  protected readonly formatEuros = formatEuros;
  protected readonly modes = SHOP_MODES;

  private readonly settings = resource({ loader: () => this.api.invoke(getShopSettings) });
  protected readonly mode = signal<ShopMode>('CLOSED');
  protected readonly pickup = signal('');
  protected readonly savingSettings = signal(false);

  protected readonly products = resource({ loader: () => this.api.invoke(listShopProducts) });
  private readonly categories = resource({ loader: () => this.api.invoke(listCategories) });
  protected readonly categoryOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Aucune' },
    ...(this.categories.value() ?? []).map((category) => ({ value: category.id, label: category.name })),
  ]);
  private readonly recipeSearch = viewChild(RecipeSearch);

  /** The product being changed; null while adding a new one. */
  protected readonly editing = signal<AdminShopProduct | null>(null);
  protected readonly recipe = signal<ChosenRecipe | null>(null);
  protected readonly name = signal('');
  protected readonly imageId = signal<string | null>(null);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly categoryId = signal<number | null>(null);
  protected readonly byBatch = signal(false);
  /** As typed in the fields. */
  protected readonly batchSize = signal('6');
  protected readonly price = signal('');
  protected readonly portionLabel = signal('');
  protected readonly recipeShare = signal('1');
  protected readonly packaging = signal('');
  protected readonly packagingCount = signal('1');
  protected readonly available = signal(true);
  protected readonly savingProduct = signal(false);

  /** "soit 2,00 € pièce", as the shop will show it. */
  protected readonly unitPrice = computed(() => {
    const price = Number(this.price());
    const size = Number(this.batchSize());
    return this.byBatch() && price > 0 && size >= 2 ? formatEuros(Math.round((price / size) * 100) / 100) : null;
  });

  constructor() {
    effect(() => {
      const settings = this.settings.value();
      if (settings) {
        this.mode.set(settings.mode);
        this.pickup.set(settings.pickupInfo ?? '');
      }
    });
  }

  protected async saveSettings(event: Event): Promise<void> {
    event.preventDefault();
    this.savingSettings.set(true);
    const saved = await attempt(
      this.api.invoke(updateShopSettings, {
        body: { mode: this.mode(), pickupInfo: this.pickup().trim() || undefined },
      }),
    );
    this.savingSettings.set(false);
    if (saved.ok) {
      this.toaster.success(`Boutique : ${SHOP_MODES.find((mode) => mode.value === saved.value.mode)?.label.toLowerCase()}`);
      void this.siteData.load();
    }
  }

  /** Its name and photo come from the recipe, as long as they were not changed by hand. */
  protected chooseRecipe(recipe: ChosenRecipe | null): void {
    const previous = this.recipe();
    this.recipe.set(recipe);
    if (recipe) {
      if (!this.name().trim() || this.name() === previous?.title) {
        this.name.set(recipe.title);
      }
      if (!this.imageId() || this.imageId() === previous?.imageId) {
        this.imageId.set(recipe.imageId ?? null);
      }
      this.categoryId.set(null);
    }
  }

  protected async upload(file: File): Promise<void> {
    this.uploadProgress.set(0);
    const sent = await attempt(this.imageUploads.send<GalleryImage>(uploadImage.PATH, file, (share) => this.uploadProgress.set(share), 'POST'));
    this.uploadProgress.set(null);
    if (sent.ok) {
      this.imageId.set(sent.value.id);
    }
  }

  protected edit(product: AdminShopProduct): void {
    this.editing.set(product);
    this.recipe.set(product.recipeId ? { id: product.recipeId, title: product.recipeTitle ?? '' } : null);
    this.name.set(product.name);
    this.imageId.set(product.imageId ?? null);
    this.categoryId.set(product.categoryId ?? null);
    this.byBatch.set(!!product.batchSize);
    this.batchSize.set(String(product.batchSize ?? 6));
    this.price.set(String(product.price));
    this.portionLabel.set(product.portionLabel ?? '');
    this.recipeShare.set(String(product.recipeShare));
    this.packaging.set(product.packaging ?? '');
    this.packagingCount.set(String(product.packagingCount));
    this.available.set(product.available);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancel(): void {
    this.editing.set(null);
    this.recipe.set(null);
    this.recipeSearch()?.reset();
    this.name.set('');
    this.imageId.set(null);
    this.categoryId.set(null);
    this.byBatch.set(false);
    this.batchSize.set('6');
    this.price.set('');
    this.portionLabel.set('');
    this.recipeShare.set('1');
    this.packaging.set('');
    this.packagingCount.set('1');
    this.available.set(true);
  }

  protected async saveProduct(event: Event): Promise<void> {
    event.preventDefault();
    const price = Number(this.price());
    const batchSize = Number(this.batchSize());
    const recipeShare = Number(this.recipeShare());
    const packagingCount = Number(this.packagingCount());
    if (!this.name().trim() || this.price().trim() === '' || !Number.isFinite(price) || price < 0) {
      this.toaster.error('Donnez un nom au produit et son prix');
      return;
    }
    if (this.byBatch() && (!Number.isInteger(batchSize) || batchSize < 2)) {
      this.toaster.error('Un lot compte 2 pièces au moins');
      return;
    }
    const body: ShopProductForm = {
      recipeId: this.recipe()?.id,
      name: this.name().trim(),
      imageId: this.imageId() ?? undefined,
      categoryId: this.recipe() ? undefined : (this.categoryId() ?? undefined),
      price,
      portionLabel: this.byBatch() ? undefined : this.portionLabel().trim() || undefined,
      batchSize: this.byBatch() ? batchSize : undefined,
      recipeShare: recipeShare > 0 ? recipeShare : 1,
      packaging: this.packaging().trim() || undefined,
      packagingCount: packagingCount >= 1 ? Math.round(packagingCount) : 1,
      available: this.available(),
    };
    const editing = this.editing();
    this.savingProduct.set(true);
    const saved = await attempt(
      editing ? this.api.invoke(updateShopProduct, { id: editing.id, body }) : this.api.invoke(createShopProduct, { body }),
    );
    this.savingProduct.set(false);
    if (saved.ok) {
      this.toaster.success(editing ? 'Produit enregistré' : 'Produit ajouté à la boutique');
      this.cancel();
      this.products.reload();
    }
  }

  protected async remove(product: AdminShopProduct): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Retirer ce produit de la boutique ?',
      message: `« ${product.name} » disparaît de la boutique ; sa recette reste sur le blog, et les demandes déjà passées le gardent`,
      confirmLabel: 'Retirer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteShopProduct, { id: product.id }))).ok) {
      this.toaster.success('Produit retiré de la boutique');
      if (this.editing()?.id === product.id) {
        this.cancel();
      }
      this.products.reload();
    }
  }
}
