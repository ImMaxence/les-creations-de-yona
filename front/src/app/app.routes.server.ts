import { RenderMode, ServerRoute } from '@angular/ssr';

// Public pages are rendered on each request: their content changes with every publication.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
