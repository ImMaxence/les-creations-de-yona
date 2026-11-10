import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Consent } from '../../analytics/consent';
import { SiteData } from '../../site/site-data';
import { Reveal } from '../../../shared/motion/reveal';
import {
  ABOUT_PATH,
  ADMIN_PATH,
  FEEDBACK_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
  ACCESSIBILITY_PATH,
  ACCESSIBILITY_STATEMENT_PATH,
  TERMS_OF_USE_PATH,
} from '../../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';
import { Icon } from '../../../shared/ui/icon/icon';
import { NotifyButton } from '../../../shared/ui/notify-button/notify-button';

@Component({
  selector: 'yona-footer',
  imports: [RouterLink, BrandIcon, Icon, NotifyButton, Reveal],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  protected readonly siteData = inject(SiteData);
  protected readonly consent = inject(Consent);
  protected readonly socialPlatformLabel = socialPlatformLabel;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;
  protected readonly termsOfUsePath = TERMS_OF_USE_PATH;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly accessibilityPath = ACCESSIBILITY_PATH;
  protected readonly accessibilityStatementPath = ACCESSIBILITY_STATEMENT_PATH;
  protected readonly adminPath = ADMIN_PATH;
  protected readonly glossaryPath = GLOSSARY_PATH;
  protected readonly aboutPath = ABOUT_PATH;
  protected readonly installPath = INSTALL_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
  protected readonly year = new Date().getFullYear();
}
