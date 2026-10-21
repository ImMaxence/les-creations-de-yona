import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  DOCUMENT,
  inject,
  isDevMode,
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
  ViewTransitionInfo,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { adminErrorsInterceptor } from './core/api/admin-errors.interceptor';
import { provideApiConfiguration } from './core/api/generated/api-configuration';
import { InstallPrompt } from './core/pwa/install-prompt';
import { offlineWarmupInterceptor } from './core/pwa/offline-warmup';
import { SeoStrategy } from './core/seo/seo-strategy';
import { SiteData } from './core/site/site-data';

/**
 * No page transition when only the query changes (search, filter, pagination): same page.
 * Nor while the phone menu is open: its own fade-out reveals the new page.
 */
function skipTransitionWhenNeeded({ transition }: ViewTransitionInfo): void {
  const router = inject(Router);
  const menuOpen = inject(DOCUMENT).querySelector('dialog[open]') !== null;
  const target = router.currentNavigation()?.finalUrl;
  const samePage =
    target &&
    router.isActive(target, {
      paths: 'exact',
      matrixParams: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
    });
  if (samePage || menuOpen) {
    // Angular logs the resulting AbortError in development builds only
    transition.skipTransition();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: skipTransitionWhenNeeded,
      }),
      // Data that cannot be loaded: error page, while keeping the URL the visitor asked for
      withNavigationErrorHandler(
        () =>
          new RedirectCommand(inject(Router).parseUrl('/erreur'), { skipLocationChange: true }),
      ),
    ),
    { provide: TitleStrategy, useExisting: SeoStrategy },
    provideHttpClient(withFetch(), withInterceptors([adminErrorsInterceptor, offlineWarmupInterceptor])),
    provideClientHydration(
      withEventReplay(),
      // Spring Security marks every API response no-store. Here it only concerns public data,
      // fetched by the server without cookies: the browser reuses it instead of fetching it again.
      withHttpTransferCacheOptions({ includeNonCacheableRequests: true }),
    ),
    // Same origin as the site: the API is served under /api
    provideApiConfiguration(''),
    provideAppInitializer(() => inject(SiteData).load()),
    provideAppInitializer(() => inject(InstallPrompt).listen()),
    // Offline reading and installation as an app (PWA). Off in development, where it would cache stale code.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
