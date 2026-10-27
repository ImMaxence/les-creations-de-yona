import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { listIngredientAisles } from '../../core/api/generated/fn/ingredients/list-ingredient-aisles';
import { ShoppingList as Basket, ingredientKey } from '../../core/kitchen/shopping-list';
import { Toaster } from '../../core/notifications/toaster';
import { Aisle, OTHER_AISLE_LABEL, groupByAisle } from '../../shared/format/aisles';
import { fold } from '../../shared/format/glossary';
import { RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { totalIngredients } from '../recipe/recipe-parts';
import { Icon } from '../../shared/ui/icon/icon';

/** Checked items are kept apart from the ingredients: their key cannot be an ingredient name. */
const EXTRA_PREFIX = '+';

/**
 * "Ma liste de courses": the ingredients of the recipes added, the same ones added up (150 g of
 * butter + 50 g = 200 g), plus anything typed by hand. Kept in this browser only; ticked off in
 * the shop, shared as text (WhatsApp, messages…). Sorted by shop aisle, those set in the
 * back-office: read when the list is shown, so that an aisle set later sorts the lists already made.
 */
@Component({
  selector: 'yona-shopping-list',
  imports: [
    Icon,
    RouterLink,
    Button,
  ],
  templateUrl: './shopping-list.html',
  styleUrl: './shopping-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShoppingList {
  protected readonly basket = inject(Basket);
  private readonly toaster = inject(Toaster);
  private readonly api = inject(Api);
  /** By folded name; empty until read, or offline the first time: the list is then unsorted. */
  private readonly aisles = signal<ReadonlyMap<string, Aisle>>(new Map());
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly shown = signal(false);
  protected readonly newItem = signal('');
  protected readonly confirmingClear = signal(false);
  protected readonly canShare = signal(false);

  /** Every ingredient once, the ones still to buy first; each with the recipes needing it. */
  protected readonly items = computed(() => {
    const checked = this.basket.checked();
    const parts = this.basket.recipes().map((recipe) => ({
      title: recipe.title,
      ingredients: recipe.lines.map((line) => ({
        name: line.name,
        quantity: line.quantity ?? undefined,
        unit: line.unit ?? undefined,
      })),
      steps: [],
    }));
    return totalIngredients(parts, 1)
      .map((item) => ({ ...item, key: ingredientKey(item.name), done: checked.has(ingredientKey(item.name)) }))
      .sort((a, b) => Number(a.done) - Number(b.done));
  });
  protected readonly extras = computed(() => {
    const checked = this.basket.checked();
    return this.basket.extras().map((text, index) => ({ text, index, done: checked.has(EXTRA_PREFIX + text) }));
  });
  /**
   * The ingredients by aisle, those still to buy first in each; what the visitor typed goes with
   * "Autres", last.
   */
  protected readonly sections = computed(() => {
    const aisles = this.aisles();
    const groups = groupByAisle(this.items(), (item) => aisles.get(fold(item.name)));
    if (this.extras().length && !groups.some((group) => group.aisle === null)) {
      groups.push({ aisle: null, label: OTHER_AISLE_LABEL, items: [] });
    }
    return groups;
  });
  /** Headings only once an aisle is known: a single "Autres" says nothing. */
  protected readonly showAisles = computed(() => this.sections().some((section) => section.aisle !== null));
  protected readonly remaining = computed(
    () => this.items().filter((item) => !item.done).length + this.extras().filter((extra) => !extra.done).length,
  );
  protected readonly isEmpty = computed(() => this.basket.count() === 0);

  constructor() {
    afterNextRender(() => {
      this.shown.set(true);
      this.canShare.set(typeof navigator.share === 'function');
      void this.loadAisles();
    });
  }

  private async loadAisles(): Promise<void> {
    try {
      const aisles = await this.api.invoke(listIngredientAisles);
      this.aisles.set(new Map(aisles.map(({ name, aisle }) => [fold(name), aisle])));
    } catch {
      // Offline, or the API unreachable: the list stays unsorted
    }
  }

  protected recipeLink(recipe: { categorySlug: string; slug: string }): string[] {
    return [RECIPES_PATH, recipe.categorySlug, recipe.slug];
  }

  protected toggleExtra(text: string): void {
    this.basket.toggle(EXTRA_PREFIX + text);
  }

  protected addItem(event: Event): void {
    event.preventDefault();
    this.basket.addExtra(this.newItem());
    this.newItem.set('');
  }

  protected clear(): void {
    this.basket.clear();
    this.confirmingClear.set(false);
  }

  /** What is still to buy, one line each, under its aisle once they are known. */
  protected text(): string {
    const lines = this.sections().flatMap((section) => {
      const toBuy = [
        ...section.items
          .filter((item) => !item.done)
          .map((item) => `- ${item.amount ? `${item.amount} ` : ''}${item.name}`),
        ...(section.aisle === null
          ? this.extras()
              .filter((extra) => !extra.done)
              .map((extra) => `- ${extra.text}`)
          : []),
      ];
      return toBuy.length && this.showAisles() ? ['', `${section.label} :`, ...toBuy] : toBuy;
    });
    return `Liste de courses (Les créations de Yona)\n${lines.join('\n')}`;
  }

  protected whatsappLink(): string {
    return `https://wa.me/?text=${encodeURIComponent(this.text())}`;
  }

  protected async share(): Promise<void> {
    try {
      await navigator.share({ title: 'Liste de courses', text: this.text() });
    } catch {
      // Closed without sharing (AbortError), nothing to report
    }
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.toaster.success('Liste copiée : collez-la où vous voulez');
    } catch {
      this.toaster.error('Copie impossible sur ce navigateur');
    }
  }
}
