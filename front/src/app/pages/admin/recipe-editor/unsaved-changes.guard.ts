import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Confirm } from '../../../core/dialog/confirm';

export interface UnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a form whose changes have not been saved. */
export const unsavedChangesGuard: CanDeactivateFn<UnsavedChanges> = (page) =>
  !page.hasUnsavedChanges() ||
  inject(Confirm).ask({
    title: 'Quitter sans enregistrer ?',
    message: 'Les modifications de cette recette seront perdues.',
    confirmLabel: 'Quitter',
  });
