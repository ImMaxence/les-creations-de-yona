import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Writes (POST, PUT, DELETE…) go straight to the network instead of through the service worker,
 * which only serves reads from its cache anyway. Relayed by the worker, Safari on iOS loses the
 * file of a photo upload, and the API receives an empty request.
 */
export const serviceWorkerBypassInterceptor: HttpInterceptorFn = (request, next) =>
  request.method === 'GET' ? next(request) : next(request.clone({ setHeaders: { 'ngsw-bypass': 'true' } }));
