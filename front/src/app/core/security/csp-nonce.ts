import { CSP_NONCE, Provider, REQUEST_CONTEXT, inject } from '@angular/core';

/** What the Express server passes to Angular for each request (see src/server.ts). */
export interface ServerRequestContext {
  /** Random value of this response's Content-Security-Policy, for the scripts Angular writes. */
  readonly cspNonce: string;
}

/**
 * Server-side only. Angular writes an inline script into every rendered page (event replay
 * bootstrap, whose content depends on the page); the nonce lets the CSP allow it and nothing else.
 */
export function provideServerCspNonce(): Provider {
  return {
    provide: CSP_NONCE,
    useFactory: () =>
      (inject(REQUEST_CONTEXT, { optional: true }) as ServerRequestContext | null)?.cspNonce ?? null,
  };
}
