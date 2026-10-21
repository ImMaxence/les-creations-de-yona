import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
/** Built files carry a content hash in their name (main-VZMLZXQS.js): a new version, a new name. */
const HASHED_FILE = /-[\w-]{8}\.(?:js|css|woff2)$/;

const app = express();
const angularApp = new AngularNodeAppEngine();

// Container health check: answers without rendering anything, whatever the Host header
app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

// Hashed files are cached for good; the others (favicon, author photo) can change under the same name
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      res.setHeader(
        'Cache-Control',
        HASHED_FILE.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
      );
    },
  }),
);

// Every other request: server-side rendering of the Angular application
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url)) {
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
