import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AdminSession } from '../auth/admin-session';
import { Toaster } from '../notifications/toaster';

const ADMIN_API = '/api/admin/';
/** Session probe, answered 401 for public visitors: never an error to report. */
const SESSION_PROBE = '/api/admin/me';
const DEFAULT_MESSAGE = "L'opération n'a pas abouti. Réessayez dans un instant.";

/** ProblemDetail sent by the API: "detail" is already a French message meant for the user. */
interface ProblemDetail {
  detail?: string;
  errors?: { field: string; message: string }[];
}

/**
 * Back-office API errors become a toast with the API's own message. An expired session sends
 * the admin back to the Google sign-in. Public API calls are left alone: their pages handle them.
 */
export const adminErrorsInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(ADMIN_API) || request.url.startsWith(SESSION_PROBE)) {
    return next(request);
  }
  const toaster = inject(Toaster);
  const session = inject(AdminSession);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          session.signIn();
        } else {
          toaster.error(messageOf(error));
        }
      }
      return throwError(() => error);
    }),
  );
};

function messageOf(error: HttpErrorResponse): string {
  const problem = (typeof error.error === 'string' ? safeParse(error.error) : error.error) as
    | ProblemDetail
    | null;
  const fieldErrors = problem?.errors?.map((fieldError) => fieldError.message).join(' ');
  return fieldErrors || problem?.detail || DEFAULT_MESSAGE;
}

/** Endpoints answering text (DELETE) receive the ProblemDetail as a string. */
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
