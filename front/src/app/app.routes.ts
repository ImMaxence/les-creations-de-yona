import { Routes } from '@angular/router';
import { RouteSeo, SEO_DATA_KEY, markdownPathOf } from './core/seo/page-seo';
import { aboutSeo } from './pages/about/about.seo';
import { homeResolver } from './pages/home/home.resolver';
import { homeSeo } from './pages/home/home.seo';
import { capEntriesResolver, capSeo, observationsResolver, observationsSeo } from './pages/cap/cap.resolver';
import {
  glossaryResolver,
  recipeObservationsResolver,
  recipeResolver,
  recipeSeo,
  relatedRecipesResolver,
} from './pages/recipe/recipe.resolver';
import { recipesResolver, recipesSeo } from './pages/recipes/recipes.resolver';
import { orderTrackingResolver, shopResolver } from './pages/shop/shop.resolver';
import { glossarySeo } from './pages/glossary/glossary.seo';
import { menuResolver, menuSeo, menusSeo } from './pages/menus/menus.resolver';
import { INSTALL_PATH, LEGAL_NOTICE_PATH, PRIVACY_POLICY_PATH, TERMS_OF_USE_PATH } from './shared/routing/links';

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
    resolve: {
      recipe: recipeResolver,
      related: relatedRecipesResolver,
      glossary: glossaryResolver,
      observations: recipeObservationsResolver,
    },
    data: { [SEO_DATA_KEY]: recipeSeo satisfies RouteSeo },
  },
  {
    path: 'mon-cap',
    pathMatch: 'full',
    loadComponent: () => import('./pages/cap/cap'),
    resolve: { entries: capEntriesResolver },
    data: { [SEO_DATA_KEY]: capSeo satisfies RouteSeo },
  },
  {
    path: 'mon-cap/observations',
    loadComponent: () => import('./pages/cap/observations'),
    resolve: { observations: observationsResolver },
    data: { [SEO_DATA_KEY]: observationsSeo satisfies RouteSeo },
    // The page lives in the query parameters
    runGuardsAndResolvers: 'pathParamsOrQueryParamsChange',
  },
  // For the people close to Yona: nothing for search engines
  {
    path: 'boutique',
    pathMatch: 'full',
    loadComponent: () => import('./pages/shop/shop'),
    resolve: { shop: shopResolver },
    data: { [SEO_DATA_KEY]: { title: 'Boutique', noIndex: true } satisfies RouteSeo },
  },
  {
    path: 'boutique/commande/:token',
    loadComponent: () => import('./pages/shop/order-tracking'),
    resolve: { order: orderTrackingResolver },
    data: { [SEO_DATA_KEY]: { title: 'Suivi de commande', noIndex: true } satisfies RouteSeo },
  },
  {
    path: 'menus',
    loadComponent: () => import('./pages/menus/menus'),
    data: { [SEO_DATA_KEY]: menusSeo satisfies RouteSeo },
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
    path: 'a-propos',
    loadComponent: () => import('./pages/about/about'),
    data: { [SEO_DATA_KEY]: aboutSeo satisfies RouteSeo },
  },
  {
    path: 'installer',
    loadComponent: () => import('./pages/install/install'),
    data: {
      [SEO_DATA_KEY]: {
        title: "Installer l'application",
        description:
          "Installez Les créations de Yona sur votre téléphone ou votre ordinateur : gratuit, sans store, et les recettes restent lisibles hors connexion",
        markdownPath: markdownPathOf(INSTALL_PATH),
      } satisfies RouteSeo,
    },
  },
  {
    path: 'donner-mon-avis',
    loadComponent: () => import('./pages/feedback/feedback'),
    data: {
      [SEO_DATA_KEY]: {
        title: 'Donner mon avis',
        description: 'Une idée de recette, une amélioration du site, un souci rencontré : écrivez à Yona',
        noIndex: true,
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
        markdownPath: markdownPathOf(LEGAL_NOTICE_PATH),
      } satisfies RouteSeo,
    },
  },
  {
    path: 'conditions-d-utilisation',
    loadComponent: () => import('./pages/legal/terms-of-use'),
    data: {
      [SEO_DATA_KEY]: {
        title: "Conditions d'utilisation",
        description: 'Accès au site, usage des recettes, partage des contenus et règles pour les assistants IA.',
        markdownPath: markdownPathOf(TERMS_OF_USE_PATH),
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
        markdownPath: markdownPathOf(PRIVACY_POLICY_PATH),
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
