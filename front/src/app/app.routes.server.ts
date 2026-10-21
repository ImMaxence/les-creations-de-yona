import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Back-office: rendered in the browser only, where the admin's session cookie lives
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  // Public pages are rendered on each request: their content changes with every publication
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
