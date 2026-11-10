import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ACCESSIBILITY_PATH, FEEDBACK_PATH } from '../../shared/routing/links';
import { CONTACT_EMAIL, LEGAL_PAGES_UPDATED_ON } from './legal';

/**
 * Déclaration d'accessibilité, on the model of the RGAA (state of conformity, tests, known limits,
 * contact, recourse). Voluntary: a personal site is not bound by article 47 of the law of 2005.
 */
@Component({
  selector: 'yona-accessibility-statement',
  imports: [RouterLink],
  templateUrl: './accessibility-statement.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AccessibilityStatement {
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly updatedOn = LEGAL_PAGES_UPDATED_ON;
  protected readonly accessibilityPath = ACCESSIBILITY_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
}
