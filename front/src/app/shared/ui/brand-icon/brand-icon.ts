import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  siFacebook,
  siInstagram,
  siPinterest,
  siReddit,
  siThreads,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
} from 'simple-icons';
import { SocialLinkResponse } from '../../../core/api/generated/models/social-link-response';

export type SocialPlatform = SocialLinkResponse['platform'];

// Lucide has no brand logos: these come from Simple Icons (CC0, public domain)
const BRANDS: Record<SocialPlatform, { label: string; path: string }> = {
  INSTAGRAM: { label: 'Instagram', path: siInstagram.path },
  TIKTOK: { label: 'TikTok', path: siTiktok.path },
  YOUTUBE: { label: 'YouTube', path: siYoutube.path },
  FACEBOOK: { label: 'Facebook', path: siFacebook.path },
  X: { label: 'X', path: siX.path },
  THREADS: { label: 'Threads', path: siThreads.path },
  REDDIT: { label: 'Reddit', path: siReddit.path },
  WHATSAPP: { label: 'WhatsApp', path: siWhatsapp.path },
  PINTEREST: { label: 'Pinterest', path: siPinterest.path },
};

/** Every platform, in the order the back-office offers them. */
export const SOCIAL_PLATFORMS = Object.keys(BRANDS) as SocialPlatform[];

export function socialPlatformLabel(platform: SocialPlatform): string {
  return BRANDS[platform].label;
}

/** Decorative brand logo: the surrounding link carries the accessible name. */
@Component({
  selector: 'yona-brand-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" [attr.width]="size()" [attr.height]="size()">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: ':host { display: inline-flex; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandIcon {
  readonly platform = input.required<SocialPlatform>();
  readonly size = input(20);

  protected readonly path = computed(() => BRANDS[this.platform()].path);
}
