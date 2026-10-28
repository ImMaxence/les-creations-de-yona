import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import type { ServerRequestContext } from './app/core/security/csp-nonce';
import { cspNonce, securityHeaders } from './server/security-headers';
import { sitemap } from './server/sitemap';

const serverDistFolder = import.meta.dirname;
const browserDistFolder = join(serverDistFolder, '../browser');
/** Built files carry a content hash in their name (main-VZMLZXQS.js): a new version, a new name. */
const HASHED_FILE = /-[\w-]{8}\.(?:js|css|woff2)$/;
/** Service worker files: always checked again, so that installed apps get the new version. */
const SERVICE_WORKER_FILE = /(?:ngsw\.json|ngsw-worker\.js|safety-worker\.js|manifest\.webmanifest)$/;

function cacheControl(path: string): string {
  if (SERVICE_WORKER_FILE.test(path)) {
    return 'no-cache';
  }
  return HASHED_FILE.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400';
}

const app = express();
const angularApp = new AngularNodeAppEngine();
/** True for the production server (node server.mjs), false inside the Angular dev server. */
const isProductionServer = isMainModule(import.meta.url);

app.disable('x-powered-by');

// Container health check: answers without rendering anything, whatever the Host header
app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

// Production only: the dev server injects its own scripts, which the CSP would block
if (isProductionServer) {
  app.use(
    securityHeaders([
      join(serverDistFolder, 'index.server.html'),
      join(browserDistFolder, 'index.csr.html'),
    ]),
  );
}

// The back-office is never indexed; the header also covers its client-rendered HTML shell
app.use('/admin', (_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.get('/sitemap.xml', sitemap);

// Hashed files are cached for good; the others (favicon, author photo) can change under the same name
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => res.setHeader('Cache-Control', cacheControl(path)),
  }),
);

// Every other request: server-side rendering of the Angular application. Pages change with every
// publication: kept by no shared cache (company proxies), checked again by the browser each time.
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  const nonce = cspNonce(res);
  const context: ServerRequestContext | undefined = nonce ? { cspNonce: nonce } : undefined;
  angularApp
    .handle(req, context)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isProductionServer) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Server listening on http://localhost:${port}`);
  });
}

/** Request handler used by the Angular CLI (dev server and build). */
export const reqHandler = createNodeRequestHandler(app);
