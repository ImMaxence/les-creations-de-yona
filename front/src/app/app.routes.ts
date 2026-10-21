import { Routes } from '@angular/router';
import { RouteSeo, SEO_DATA_KEY } from './core/seo/page-seo';
import { homeResolver } from './pages/home/home.resolver';
import { homeSeo } from './pages/home/home.seo';
import { recipeResolver, recipeSeo } from './pages/recipe/recipe.resolver';
import { recipesResolver, recipesSeo } from './pages/recipes/recipes.resolver';

const NO_INDEX: RouteSeo = { noIndex: true };

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home'),
    resolve: { data: homeResolver },
    data: { [SEO_DATA_KEY]: homeSeo satisfies RouteSeo },
  },
  {
    path: 'recettes',
    loadComponent: () => import('./pages/recipes/recipes'),
    resolve: { data: recipesResolver },
    data: { [SEO_DATA_KEY]: recipesSeo satisfies RouteSeo },
    // Search, category and page live in the query parameters
    runGuardsAndResolvers: 'pathParamsOrQueryParamsChange',
  },
  {
    path: 'recettes/:categorySlug/:recipeSlug',
    loadComponent: () => import('./pages/recipe/recipe'),
    resolve: { recipe: recipeResolver },
    data: { [SEO_DATA_KEY]: recipeSeo satisfies RouteSeo },
  },
  {
    path: 'erreur',
    loadComponent: () => import('./pages/server-error/server-error'),
    title: 'Erreur',
    data: { [SEO_DATA_KEY]: NO_INDEX },
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found'),
    title: 'Page introuvable',
    data: { [SEO_DATA_KEY]: NO_INDEX },
  },
];
