import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import {
  RedirectCommand,
  Router,
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { provideApiConfiguration } from './core/api/generated/api-configuration';
import { PageTitleStrategy } from './core/routing/page-title-strategy';
import { SiteData } from './core/site/site-data';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withViewTransitions({ skipInitialTransition: true }),
      // Data that cannot be loaded: error page, while keeping the URL the visitor asked for
      withNavigationErrorHandler(
        () =>
          new RedirectCommand(inject(Router).parseUrl('/erreur'), { skipLocationChange: true }),
      ),
    ),
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    provideHttpClient(withFetch()),
    provideClientHydration(
      withEventReplay(),
      // Spring Security marks every API response no-store. Here it only concerns public data,
      // fetched by the server without cookies: the browser reuses it instead of fetching it again.
      withHttpTransferCacheOptions({ includeNonCacheableRequests: true }),
    ),
    // Same origin as the site: the API is served under /api
    provideApiConfiguration(''),
    provideAppInitializer(() => inject(SiteData).load()),
  ],
};
