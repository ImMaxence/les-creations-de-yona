import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AdminSession } from './admin-session';

/**
 * Back-office pages: an admin session is required. Without one, the browser goes to the Google
 * sign-in; the backend brings it back to /admin, or to /admin/acces-refuse for another account.
 */
export const adminGuard: CanActivateFn = async () => {
  const session = inject(AdminSession);
  if (session.isAdmin() || (await session.load())) {
    return true;
  }
  session.signIn();
  return false;
};
