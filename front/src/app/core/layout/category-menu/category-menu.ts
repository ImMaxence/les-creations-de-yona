import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryResponse } from '../../api/generated/models/category-response';
import { Theme, categoriesOf, categoryOfThemeQueryParams, themeLabel, themeSlug } from '../../../shared/format/themes';
import { RECIPES_PATH } from '../../../shared/routing/links';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * A theme's dropdown of the navbar ("Salé", "Sucré"): its categories, and all its recipes. A
 * category holding both is in each menu it has recipes for, and opens only those of the theme. On
 * phones, the mobile menu lists them instead.
 */
@Component({
  selector: 'yona-category-menu',
  imports: [Icon, RouterLink],
  templateUrl: './category-menu.html',
  styleUrl: './category-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(keydown.escape)': 'closeAndFocusTrigger()',
  },
})
export class CategoryMenu {
  readonly theme = input.required<Theme>();
  /** Every category of the site: those of the theme are picked here. */
  readonly categories = input.required<CategoryResponse[]>();

  protected readonly open = signal(false);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly label = computed(() => themeLabel(this.theme()));
  protected readonly panelId = computed(() => `category-menu-${themeSlug(this.theme())}`);
  protected readonly shown = computed(() => categoriesOf(this.categories(), this.theme()));
  protected readonly allQueryParams = computed(() => ({ theme: themeSlug(this.theme()) }));

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected queryParams(category: CategoryResponse): Record<string, string> {
    return categoryOfThemeQueryParams(category, this.theme());
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) {
      this.close();
    }
  }

  protected closeAndFocusTrigger(): void {
    if (this.open()) {
      this.close();
      this.host.querySelector('button')?.focus();
    }
  }
}
