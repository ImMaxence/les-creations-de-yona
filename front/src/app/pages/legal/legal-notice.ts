import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_POLICY_PATH } from '../../shared/routing/links';
import { CONTACT_EMAIL, LEGAL_PAGES_UPDATED_ON } from './legal';

@Component({
  selector: 'yona-legal-notice',
  imports: [RouterLink],
  templateUrl: './legal-notice.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LegalNotice {
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly updatedOn = LEGAL_PAGES_UPDATED_ON;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
}
