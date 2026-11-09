import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { RequestHandler, Response } from 'express';

/** Inline scripts of an HTML template: <script> elements without a src attribute. */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

/**
 * CSP hashes of the inline scripts the build writes into the HTML templates (the event replay
 * contract, for instance). Read from the built files, so they follow every Angular update.
 */
function inlineScriptHashes(templatePaths: string[]): string[] {
  const hashes = new Set<string>();
  for (const path of templatePaths) {
    for (const [, content] of readFileSync(path, 'utf8').matchAll(INLINE_SCRIPT)) {
      if (content.trim()) {
        hashes.add(`'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`);
      }
    }
  }
  return [...hashes];
}

function contentSecurityPolicy(nonce: string, scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    // Scripts: the site's own files, the build's inline scripts (hashes) and the one Angular
    // writes while rendering (nonce). Nothing else, so an injected script would not run.
    // Google Analytics: its script, loaded only once the visitor has accepted (core/analytics).
    // reCAPTCHA of "Donner mon avis".
    // wasm-unsafe-eval: ONNX Runtime's WebAssembly, for the models running in the back-office.
    `script-src 'self' 'nonce-${nonce}' ${scriptHashes.join(' ')} 'wasm-unsafe-eval' https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`,
    // Angular sets component styles and style bindings inline: no nonce on that side.
    "style-src 'self' 'unsafe-inline'",
    // blob: preview of a photo before upload in the back-office.
    "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com https://*.googleusercontent.com",
    // Google Analytics sends its measures there; reCAPTCHA calls its own API from the page.
    // The service worker fetches a page's scripts and images under this directive, not script-src or
    // img-src: a host of those also goes here (Google's: the photo of the admins' accounts). An installed worker keeps the policy it was installed with: after
    // a change here, change its address too (provideServiceWorker, app.config.ts).
    // Hugging Face: the models the back-office downloads once, past the service worker (model-store.ts).
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://huggingface.co https://*.hf.co https://*.googleusercontent.com",
    // Recipe videos: YouTube's privacy-enhanced player, loaded only after a click (YoutubeVideo).
    'frame-src https://www.youtube-nocookie.com https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const STATIC_HEADERS: Record<string, string> = {
  // Ignored by browsers over plain http (local runs). No includeSubDomains: other subdomains may not
  // serve https.
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  // Legacy equivalent of frame-ancestors 'none'.
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Screen wake lock (recipe page) stays allowed, it is not listed here.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Nonce of the current response, to hand over to Angular's rendering. Unset in development. */
export function cspNonce(res: Response): string | undefined {
  return res.locals['cspNonce'] as string | undefined;
}

/**
 * Security headers on every response of the front server. The backend gets its own from Spring
 * Security. Fails at startup if a template is missing, rather than serving pages without a CSP.
 */
export function securityHeaders(templatePaths: string[]): RequestHandler {
  const scriptHashes = inlineScriptHashes(templatePaths);
  return (_req, res, next) => {
    const nonce = randomBytes(16).toString('base64');
    res.locals['cspNonce'] = nonce;
    res.setHeader('Content-Security-Policy', contentSecurityPolicy(nonce, scriptHashes));
    for (const [name, value] of Object.entries(STATIC_HEADERS)) {
      res.setHeader(name, value);
    }
    next();
  };
}
