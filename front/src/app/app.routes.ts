import { Routes } from '@angular/router';
import { RouteSeo, SEO_DATA_KEY } from './core/seo/page-seo';
import { homeResolver } from './pages/home/home.resolver';
import { homeSeo } from './pages/home/home.seo';
import { glossaryResolver, recipeResolver, recipeSeo, relatedRecipesResolver } from './pages/recipe/recipe.resolver';
import { recipesResolver, recipesSeo } from './pages/recipes/recipes.resolver';
import { glossarySeo } from './pages/glossary/glossary.seo';
import { MENUS_SEO, menuResolver, menuSeo } from './pages/menus/menus.resolver';

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
    resolve: { recipe: recipeResolver, related: relatedRecipesResolver, glossary: glossaryResolver },
    data: { [SEO_DATA_KEY]: recipeSeo satisfies RouteSeo },
  },
  {
    path: 'menus',
    loadComponent: () => import('./pages/menus/menus'),
    data: { [SEO_DATA_KEY]: MENUS_SEO satisfies RouteSeo },
  },
  {
    path: 'menus/:slug',
    loadComponent: () => import('./pages/menus/menu'),
    resolve: { menu: menuResolver },
    data: { [SEO_DATA_KEY]: menuSeo satisfies RouteSeo },
  },
  {
    path: 'glossaire',
    loadComponent: () => import('./pages/glossary/glossary'),
    resolve: { terms: glossaryResolver },
    data: { [SEO_DATA_KEY]: glossarySeo satisfies RouteSeo },
  },
  {
    path: 'installer',
    loadComponent: () => import('./pages/install/install'),
    data: {
      [SEO_DATA_KEY]: {
        title: "Installer l'application",
        description:
          "Installez Les créations de Yona sur votre téléphone ou votre ordinateur : gratuit, sans store, et les recettes restent lisibles hors connexion",
      } satisfies RouteSeo,
    },
  },
  // Kept in the visitor's browser: nothing for search engines
  {
    path: 'favoris',
    loadComponent: () => import('./pages/favorites/favorites'),
    data: { [SEO_DATA_KEY]: { title: 'Mes favoris', noIndex: true } satisfies RouteSeo },
  },
  {
    path: 'liste-de-courses',
    loadComponent: () => import('./pages/shopping-list/shopping-list'),
    data: { [SEO_DATA_KEY]: { title: 'Ma liste de courses', noIndex: true } satisfies RouteSeo },
  },
  {
    path: 'mentions-legales',
    loadComponent: () => import('./pages/legal/legal-notice'),
    data: {
      [SEO_DATA_KEY]: {
        title: 'Mentions légales',
        description: 'Éditeur, hébergement et propriété intellectuelle du site Les créations de Yona.',
      } satisfies RouteSeo,
    },
  },
  {
    path: 'politique-de-confidentialite',
    loadComponent: () => import('./pages/legal/privacy-policy'),
    data: {
      [SEO_DATA_KEY]: {
        title: 'Politique de confidentialité',
        description: 'Données personnelles et cookies : ce que le site collecte (presque rien) et pourquoi.',
      } satisfies RouteSeo,
    },
  },
  {
    path: 'admin',
    loadChildren: () => import('./pages/admin/admin.routes').then((module) => module.adminRoutes),
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
