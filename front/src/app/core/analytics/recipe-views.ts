import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Api } from '../api/generated/api';
import { recordRecipeView } from '../api/generated/fn/recipes/record-recipe-view';

/** Recipes already counted in this tab: a reload or a way back to them counts nothing more. */
const STORAGE_KEY = 'yona-viewed-recipes';
const KEPT = 200;

/**
 * Views of the recipes, for the back-office statistics: the browser tells the API once per visit
 * (the tab's session) that a recipe page was opened. Nothing about the visitor is sent, and no
 * consent is needed: no cookie, nothing kept beyond the tab. Robots that do not run JavaScript,
 * and browsers driven by a program (tests, Lighthouse), are not counted; the API leaves out the
 * admins' own visits.
 */
@Injectable({ providedIn: 'root' })
export class RecipeViews {
  private readonly api = inject(Api);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  count(slug: string): void {
    if (!this.isBrowser || navigator.webdriver) {
      return;
    }
    const seen = read();
    if (seen.includes(slug)) {
      return;
    }
    write([...seen, slug].slice(-KEPT));
    // Offline, or the API out of reach: the view is not counted, nothing to tell the visitor
    this.api.invoke(recordRecipeView, { slug }).catch(() => undefined);
  }
}

function read(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((slug): slug is string => typeof slug === 'string') : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // Storage blocked (private browsing): counted again on the next visit of the page
  }
}
