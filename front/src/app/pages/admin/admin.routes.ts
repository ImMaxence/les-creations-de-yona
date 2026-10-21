import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/admin.guard';
import { RouteSeo, SEO_DATA_KEY } from '../../core/seo/page-seo';
import { adminRecipeResolver } from './recipe-editor/admin-recipe.resolver';
import { unsavedChangesGuard } from './recipe-editor/unsaved-changes.guard';

const NO_INDEX: RouteSeo = { noIndex: true };

/** Back-office, loaded only when an admin opens it. */
export const adminRoutes: Routes = [
  {
    path: 'acces-refuse',
    loadComponent: () => import('./access-denied/access-denied'),
    title: 'Accès refusé',
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
        path: 'categories',
        loadComponent: () => import('./categories/admin-categories'),
        title: 'Catégories · Back-office',
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
        path: 'sauvegarde',
        loadComponent: () => import('./backup/admin-backup'),
        title: 'Sauvegarde · Back-office',
      },
    ],
  },
];
