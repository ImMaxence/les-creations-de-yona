import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Consent } from '../../core/analytics/consent';
import { GA_MEASUREMENT_ID } from '../../core/analytics/analytics';
import { FEEDBACK_PATH, INSTALL_PATH, LEGAL_NOTICE_PATH } from '../../shared/routing/links';
import { CONTACT_EMAIL, LEGAL_PAGES_UPDATED_ON } from './legal';

@Component({
  selector: 'yona-privacy-policy',
  imports: [RouterLink],
  templateUrl: './privacy-policy.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PrivacyPolicy {
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly updatedOn = LEGAL_PAGES_UPDATED_ON;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;
  protected readonly installPath = INSTALL_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
  protected readonly consent = inject(Consent);
  /** Name of the cookie Google Analytics 4 sets for this property: _ga_ and the id without "G-". */
  protected readonly propertyCookie = `_ga_${GA_MEASUREMENT_ID.replace(/^G-/, '')}`;
}
