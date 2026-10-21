import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteData } from '../../site/site-data';
import { Reveal } from '../../../shared/motion/reveal';
import { LEGAL_NOTICE_PATH, PRIVACY_POLICY_PATH } from '../../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';

@Component({
  selector: 'yona-footer',
  imports: [RouterLink, BrandIcon, Reveal],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  protected readonly siteData = inject(SiteData);
  protected readonly socialPlatformLabel = socialPlatformLabel;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly year = new Date().getFullYear();
}
