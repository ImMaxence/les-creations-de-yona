import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShoppingList as Basket, ingredientKey } from '../../core/kitchen/shopping-list';
import { Toaster } from '../../core/notifications/toaster';
import { RECIPES_PATH } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { totalIngredients } from '../recipe/recipe-parts';
import { Icon } from '../../shared/ui/icon/icon';

/** Checked items are kept apart from the ingredients: their key cannot be an ingredient name. */
const EXTRA_PREFIX = '+';

/**
 * "Ma liste de courses": the ingredients of the recipes added, the same ones added up (150 g of
 * butter + 50 g = 200 g), plus anything typed by hand. Kept in this browser only; ticked off in
 * the shop, shared as text (WhatsApp, messages…).
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
  protected readonly remaining = computed(
    () => this.items().filter((item) => !item.done).length + this.extras().filter((extra) => !extra.done).length,
  );
  protected readonly isEmpty = computed(() => this.basket.count() === 0);

  constructor() {
    afterNextRender(() => {
      this.shown.set(true);
      this.canShare.set(typeof navigator.share === 'function');
    });
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

  /** What is still to buy, one line each. */
  protected text(): string {
    const lines = [
      ...this.items()
        .filter((item) => !item.done)
        .map((item) => `- ${item.amount ? `${item.amount} ` : ''}${item.name}`),
      ...this.extras()
        .filter((extra) => !extra.done)
        .map((extra) => `- ${extra.text}`),
    ];
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
      this.toaster.success('Liste copiée : collez-la où vous voulez.');
    } catch {
      this.toaster.error('Copie impossible sur ce navigateur.');
    }
  }
}
