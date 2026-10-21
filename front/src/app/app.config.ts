import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
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
    provideClientHydration(withEventReplay()),
    // Same origin as the site: the API is served under /api
    provideApiConfiguration(''),
    provideAppInitializer(() => inject(SiteData).load()),
  ],
};
