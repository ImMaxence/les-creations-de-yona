import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SiteData } from '../../site/site-data';
import { themeGroupsOf } from '../../../shared/format/themes';
import { GLOSSARY_PATH, MENUS_PATH, RECIPES_PATH } from '../../../shared/routing/links';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * "Recettes" in the navbar: one panel for every way into the recipes (all of them, the menus, the
 * glossary, and the categories of each theme). On phones, the mobile menu lists them instead.
 */
@Component({
  selector: 'yona-recipes-menu',
  imports: [Icon, RouterLink, RouterLinkActive],
  templateUrl: './recipes-menu.html',
  styleUrl: './recipes-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(keydown.escape)': 'closeAndFocusTrigger()',
  },
})
export class RecipesMenu {
  protected readonly siteData = inject(SiteData);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly menusPath = MENUS_PATH;
  protected readonly glossaryPath = GLOSSARY_PATH;
  protected readonly themeGroups = computed(() => themeGroupsOf(this.siteData.categories()));
  protected readonly open = signal(false);

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
