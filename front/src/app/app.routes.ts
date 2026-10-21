import { Routes } from '@angular/router';
import { homeResolver } from './pages/home/home.resolver';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home'),
    resolve: { data: homeResolver },
  },
  {
    path: 'erreur',
    loadComponent: () => import('./pages/server-error/server-error'),
    title: 'Erreur',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found'),
    title: 'Page introuvable',
  },
];
