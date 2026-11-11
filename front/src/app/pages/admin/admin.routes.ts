import { Routes } from '@angular/router';
import { adminGuard, signedOutGuard } from '../../core/auth/admin.guard';
import { RouteSeo, SEO_DATA_KEY } from '../../core/seo/page-seo';
import { adminRecipePreviewResolver, adminRecipeResolver } from './recipe-editor/admin-recipe.resolver';
import { unsavedChangesGuard } from './recipe-editor/unsaved-changes.guard';

const NO_INDEX: RouteSeo = { noIndex: true };

/** Back-office, loaded only when an admin opens it. */
export const adminRoutes: Routes = [
  {
    path: 'connexion',
    loadComponent: () => import('./login/admin-login'),
    canActivate: [signedOutGuard],
    title: 'Connexion · Back-office',
    data: { [SEO_DATA_KEY]: NO_INDEX },
  },
  {
    path: 'acces-refuse',
    loadComponent: () => import('./login/admin-login'),
    title: 'Accès refusé',
    data: { [SEO_DATA_KEY]: NO_INDEX, denied: true },
  },
  // A recipe as visitors see it, drafts included: outside the back-office layout, within the site's
  {
    path: 'apercu/:id',
    loadComponent: () => import('./recipe-preview/recipe-preview'),
    canActivate: [adminGuard],
    resolve: { recipe: adminRecipePreviewResolver },
    title: 'Aperçu · Back-office',
    data: { [SEO_DATA_KEY]: NO_INDEX },
  },
  {
    path: '',
    loadComponent: () => import('./layout/admin-layout'),
    canActivate: [adminGuard],
    data: { [SEO_DATA_KEY]: NO_INDEX },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'recettes' },
      {
        path: 'recettes',
        loadComponent: () => import('./recipes/admin-recipes'),
        title: 'Recettes · Back-office',
      },
      {
        path: 'recettes/nouvelle',
        loadComponent: () => import('./recipe-editor/admin-recipe-editor'),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nouvelle recette · Back-office',
      },
      {
        path: 'recettes/:id',
        loadComponent: () => import('./recipe-editor/admin-recipe-editor'),
        resolve: { recipe: adminRecipeResolver },
        canDeactivate: [unsavedChangesGuard],
        title: 'Modifier une recette · Back-office',
      },
      {
        path: 'statistiques',
        loadComponent: () => import('./stats/admin-stats'),
        title: 'Statistiques · Back-office',
      },
      {
        path: 'categories',
        loadComponent: () => import('./categories/admin-categories'),
        title: 'Catégories · Back-office',
      },
      {
        path: 'tags',
        loadComponent: () => import('./tags/admin-tags'),
        title: 'Tags · Back-office',
      },
      {
        path: 'menus',
        loadComponent: () => import('./menus/admin-menus'),
        title: 'Menus · Back-office',
      },
      {
        path: 'glossaire',
        loadComponent: () => import('./glossary/admin-glossary'),
        title: 'Glossaire · Back-office',
      },
      {
        path: 'mon-cap',
        loadComponent: () => import('./cap/admin-cap'),
        title: 'Mon CAP · Back-office',
      },
      {
        path: 'mon-cap/nouveau',
        loadComponent: () => import('./cap/admin-cap-editor'),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nouvel article · Back-office',
      },
      {
        path: 'mon-cap/:id',
        loadComponent: () => import('./cap/admin-cap-editor'),
        canDeactivate: [unsavedChangesGuard],
        title: 'Modifier un article · Back-office',
      },
      {
        path: 'boutique/commandes',
        loadComponent: () => import('./shop/admin-orders'),
        title: 'Commandes · Back-office',
      },
      {
        path: 'boutique/commandes/:id',
        loadComponent: () => import('./shop/admin-order'),
        title: 'Commande · Back-office',
      },
      {
        path: 'boutique/factures/:id',
        loadComponent: () => import('./shop/admin-invoice'),
        title: 'Facture · Back-office',
      },
      {
        path: 'boutique/produits',
        loadComponent: () => import('./shop/admin-products'),
        title: 'Boutique · Back-office',
      },
      {
        path: 'boutique/comptabilite',
        loadComponent: () => import('./shop/admin-accounting'),
        title: 'Comptabilité · Back-office',
      },
      {
        path: 'corbeille',
        loadComponent: () => import('./trash/admin-trash'),
        title: 'Corbeille · Back-office',
      },
      {
        path: 'ingredients',
        loadComponent: () => import('./ingredients/admin-ingredients'),
        title: 'Ingrédients · Back-office',
      },
      {
        path: 'reseaux-sociaux',
        loadComponent: () => import('./social-links/admin-social-links'),
        title: 'Réseaux sociaux · Back-office',
      },
      {
        path: 'galerie',
        loadComponent: () => import('./gallery/admin-gallery'),
        title: 'Galerie · Back-office',
      },
      {
        path: 'preferences',
        loadComponent: () => import('./preferences/admin-preferences'),
        title: 'Préférences · Back-office',
      },
      {
        path: 'apparence',
        loadComponent: () => import('./appearance/admin-appearance'),
        title: 'Apparence · Back-office',
      },
      {
        path: 'nouveautes',
        loadComponent: () => import('./changelog/admin-changelog'),
        title: 'Nouveautés · Back-office',
      },
      {
        path: 'sauvegarde',
        loadComponent: () => import('./backup/admin-backup'),
        title: 'Sauvegarde · Back-office',
      },
      {
        path: 'retours',
        loadComponent: () => import('./feedback/admin-feedback'),
        title: 'Retours · Back-office',
      },
      {
        path: 'historique',
        loadComponent: () => import('./history/admin-history'),
        title: 'Historique · Back-office',
      },
      {
        path: 'journaux',
        loadComponent: () => import('./logs/admin-logs'),
        title: 'Journaux · Back-office',
      },
    ],
  },
];
