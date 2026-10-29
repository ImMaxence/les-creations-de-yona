import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MenuDetail } from '../../core/api/generated/models/menu-detail';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { ShoppingList } from '../../core/kitchen/shopping-list';
import Menu from './menu';

const CARD = { createdAt: '2026-10-01T10:00:00Z', categories: [{ id: 1, name: 'Desserts', slug: 'desserts', theme: 'SWEET' as const, publishedThemes: [] }] };
const MENU: MenuDetail = {
  title: "Repas d'automne",
  slug: 'repas-d-automne',
  updatedAt: '2026-10-27T10:00:00Z',
  recipes: [
    { ...CARD, title: 'Tarte fine', slug: 'tarte' },
    { ...CARD, title: 'Gâteau', slug: 'gateau' },
  ],
};

function detail(slug: string, servings: number): RecipeDetail {
  return {
    slug,
    title: slug,
    servings,
    categories: CARD.categories,
    parts: [{ ingredients: [{ name: 'Beurre', quantity: 50, unit: 'g' }], steps: [] }],
  } as unknown as RecipeDetail;
}

describe('Menu', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('adds every recipe of the menu to the shopping list, for its own servings', async () => {
    const fixture = TestBed.createComponent(Menu);
    fixture.componentRef.setInput('menu', MENU);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent).toContain('Tout ajouter à ma liste de courses');
    button.click();
    http.expectOne((request) => request.url.endsWith('/api/recipes/tarte')).flush(detail('tarte', 6));
    http.expectOne((request) => request.url.endsWith('/api/recipes/gateau')).flush(detail('gateau', 8));
    await fixture.whenStable();
    fixture.detectChanges();

    const list = TestBed.inject(ShoppingList);
    expect(list.recipes().map((recipe) => [recipe.slug, recipe.servings])).toEqual([
      ['tarte', 6],
      ['gateau', 8],
    ]);
    expect(fixture.nativeElement.textContent).toContain('Voir ma liste');
    http.verify();
  });
});
