import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { provideInternalApiUrl } from './core/api/internal-api-url';
import { provideServerCspNonce } from './core/security/csp-nonce';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideServerCspNonce(),
    // API_URL (e.g. http://back:8080): the server calls the API directly. Unset in development,
    // where the dev server proxies /api to the backend.
    provideInternalApiUrl(process.env['API_URL']),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
