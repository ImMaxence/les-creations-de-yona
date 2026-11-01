import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEEDBACK_PATH, LEGAL_NOTICE_PATH, PRIVACY_POLICY_PATH } from '../../shared/routing/links';
import { CONTACT_EMAIL, LEGAL_PAGES_UPDATED_ON } from './legal';

@Component({
  selector: 'yona-terms-of-use',
  imports: [RouterLink],
  templateUrl: './terms-of-use.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TermsOfUse {
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly updatedOn = LEGAL_PAGES_UPDATED_ON;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
}
