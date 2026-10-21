import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideChevronDown } from '@lucide/angular';
import { CategoryResponse } from '../../api/generated/models/category-response';
import { RECIPES_PATH, categoryQueryParams } from '../../../shared/routing/links';

/** Desktop "Catégories" dropdown of the navbar. On phones, the mobile menu lists them instead. */
@Component({
  selector: 'yona-category-menu',
  imports: [RouterLink, LucideChevronDown, LucideArrowRight],
  templateUrl: './category-menu.html',
  styleUrl: './category-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(keydown.escape)': 'closeAndFocusTrigger()',
  },
})
export class CategoryMenu {
  readonly categories = input.required<CategoryResponse[]>();

  protected readonly open = signal(false);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

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
