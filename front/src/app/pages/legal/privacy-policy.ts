import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { INSTALL_PATH, LEGAL_NOTICE_PATH } from '../../shared/routing/links';
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
}
