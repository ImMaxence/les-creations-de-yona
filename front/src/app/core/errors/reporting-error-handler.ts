import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';

/** A page that breaks in a loop says enough after a few. */
const MAX_REPORTS_PER_VISIT = 10;

const ENDPOINT = '/api/browser-errors';

/** What is sent: the message, the stack, the page without its query. Nothing of the visitor. */
export function browserError(error: unknown, path: string): { message: string; detail?: string; page: string } | null {
  if (error instanceof HttpErrorResponse) {
    // A refused or failed request: the backend knows it already
    return null;
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const detail = error instanceof Error && error.stack ? error.stack.slice(0, 20_000) : undefined;
  return { message: message.slice(0, 2000) || 'Erreur sans message', detail, page: path.slice(0, 500) };
}

/**
 * The errors of the visitors' browsers, in the back-office's "Journaux": shown in the console as
 * Angular does, then sent once each, ten per visit at most. Not while developing, nor on the server
 * (its own errors are in its logs).
 */
@Injectable()
export class ReportingErrorHandler extends ErrorHandler {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sent = new Set<string>();

  override handleError(error: unknown): void {
    super.handleError(error);
    if (!this.browser || isDevMode() || this.sent.size >= MAX_REPORTS_PER_VISIT) {
      return;
    }
    const report = browserError(error, location.pathname);
    if (!report || this.sent.has(report.message)) {
      return;
    }
    this.sent.add(report.message);
    // fetch rather than HttpClient: its interceptors could fail in turn, and keepalive outlives a page left
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => undefined);
  }
}
