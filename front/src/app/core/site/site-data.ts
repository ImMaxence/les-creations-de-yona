import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, REQUEST, computed, inject, signal } from '@angular/core';
import { Api } from '../api/generated/api';
import { listCategories } from '../api/generated/fn/categories/list-categories';
import { listMenus } from '../api/generated/fn/menus/list-menus';
import { getSiteContent } from '../api/generated/fn/site-content/get-site-content';
import { getSiteSections } from '../api/generated/fn/site-content/get-site-sections';
import { listSocialLinks } from '../api/generated/fn/social-links/list-social-links';
import { CategoryResponse } from '../api/generated/models/category-response';
import { MenuSummary } from '../api/generated/models/menu-summary';
import { SiteContentResponse } from '../api/generated/models/site-content-response';
import { SiteSections } from '../api/generated/models/site-sections';
import { SocialLinkResponse } from '../api/generated/models/social-link-response';

/** Without an answer of the API, no link to them. */
const NO_SECTIONS: SiteSections = { capPublished: false, shopOpen: false };

/** Texts of the site until the API answers, or if it cannot: the ones the migration starts with. */
const DEFAULT_CONTENT: SiteContentResponse = {
  aboutTitle: 'Bienvenue dans ma cuisine',
  aboutText:
    "Je m'appelle Yona, je relève un grand défi en me lançant dans une aventure extraordinaire : faire de ma passion un métier et obtenir mon CAP Pâtisserie !",
  footerText: 'Des recettes maison, à partager sans modération',
  latestEyebrow: 'Fraîchement publiées',
  latestTitle: 'Dernières recettes',
  menusEyebrow: 'Pour chaque occasion',
  menusTitle: 'Nos menus',
  categoriesEyebrow: "Envie d'une douceur ?",
  categoriesTitle: 'Catégories',
};

/**
 * Data shown on every page (navbar categories and menus, footer social links and text, "À propos"). Loaded once, before the
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
  private readonly contentState = signal<SiteContentResponse>(DEFAULT_CONTENT);
  private readonly menusState = signal<MenuSummary[]>([]);
  private readonly sectionsState = signal<SiteSections>(NO_SECTIONS);

  readonly categories = this.categoriesState.asReadonly();
  readonly socialLinks = this.socialLinksState.asReadonly();
  /** Edited in the back-office (Préférences); the site's name and icon stay in the code. */
  readonly content = this.contentState.asReadonly();
  /** Published menus: the "Menus" link and the home section only show when there are some. */
  readonly menus = this.menusState.asReadonly();
  /** "Mon CAP" has a published step: its link only shows then. */
  readonly capPublished = computed(() => this.sectionsState().capPublished);
  /** Open in the back-office: the "Boutique" link only shows then. */
  readonly shopOpen = computed(() => this.sectionsState().shopOpen);

  async load(): Promise<void> {
    if (this.isBuildTime) {
      return;
    }
    // The shell still renders without them: an unavailable API must not take the site down
    const [categories, socialLinks, content, menus, sections] = await Promise.all([
      this.api.invoke(listCategories).catch(() => []),
      this.api.invoke(listSocialLinks).catch(() => []),
      this.api.invoke(getSiteContent).catch(() => DEFAULT_CONTENT),
      this.api.invoke(listMenus).catch(() => []),
      this.api.invoke(getSiteSections).catch(() => NO_SECTIONS),
    ]);
    this.categoriesState.set(categories);
    this.menusState.set(menus);
    this.sectionsState.set(sections);
    this.socialLinksState.set(socialLinks);
    this.contentState.set(content);
  }

  /** After a save in the back-office: the footer follows at once. */
  setContent(content: SiteContentResponse): void {
    this.contentState.set(content);
  }
}
