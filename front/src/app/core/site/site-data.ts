import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, REQUEST, inject, signal } from '@angular/core';
import { Api } from '../api/generated/api';
import { listCategories } from '../api/generated/fn/categories/list-categories';
import { listSocialLinks } from '../api/generated/fn/social-links/list-social-links';
import { CategoryResponse } from '../api/generated/models/category-response';
import { SocialLinkResponse } from '../api/generated/models/social-link-response';

/**
 * Data shown on every page (navbar categories, footer social links). Loaded once, before the
 * first render: the server and the browser render the same shell, so hydration has nothing to
 * redo. In the browser the responses come from the HTTP transfer cache, without a new request.
 */
@Injectable({ providedIn: 'root' })
export class SiteData {
  private readonly api = inject(Api);
  // At build time (route extraction), the app runs on the server without any request nor API
  private readonly isBuildTime =
    isPlatformServer(inject(PLATFORM_ID)) && inject(REQUEST, { optional: true }) === null;

  private readonly categoriesState = signal<CategoryResponse[]>([]);
  private readonly socialLinksState = signal<SocialLinkResponse[]>([]);

  readonly categories = this.categoriesState.asReadonly();
  readonly socialLinks = this.socialLinksState.asReadonly();

  async load(): Promise<void> {
    if (this.isBuildTime) {
      return;
    }
    // The shell still renders without them: an unavailable API must not take the site down
    const [categories, socialLinks] = await Promise.all([
      this.api.invoke(listCategories).catch(() => []),
      this.api.invoke(listSocialLinks).catch(() => []),
    ]);
    this.categoriesState.set(categories);
    this.socialLinksState.set(socialLinks);
  }
}
