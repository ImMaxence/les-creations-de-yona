import { DOCUMENT, EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import {
  DEFAULT_DESCRIPTION,
  PageSeo,
  RouteSeo,
  SEO_DATA_KEY,
  SITE_NAME,
  absoluteUrl,
} from './page-seo';

const JSON_LD_ID = 'page-json-ld';

/**
 * Applies the SEO of the page after each navigation, on the server as in the browser: title,
 * meta description, Open Graph, canonical URL, robots and JSON-LD. Pages declare it in their
 * route (data.seo); the route "title" is used when the page gives no title of its own.
 */
@Injectable({ providedIn: 'root' })
export class SeoStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(EnvironmentInjector);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const route = deepestChild(snapshot.root);
    const seo = this.seoOf(route);

    const pageTitle = seo.title ?? this.buildTitle(snapshot);
    const title = pageTitle ? `${pageTitle} · ${SITE_NAME}` : SITE_NAME;
    const description = seo.description ?? DEFAULT_DESCRIPTION;
    const url = absoluteUrl(seo.canonicalPath ?? snapshot.url.split(/[?#]/)[0]);

    this.title.setTitle(title);
    this.setMeta('name', 'description', description);
    this.setMeta('name', 'robots', seo.noIndex ? 'noindex' : 'index, follow');
    this.setMeta('property', 'og:site_name', SITE_NAME);
    this.setMeta('property', 'og:locale', 'fr_FR');
    this.setMeta('property', 'og:type', seo.type ?? 'website');
    this.setMeta('property', 'og:title', pageTitle ?? SITE_NAME);
    this.setMeta('property', 'og:description', description);
    this.setMeta('property', 'og:url', url);
    this.setMeta('property', 'og:image', seo.image ? absoluteUrl(seo.image) : null);
    this.setMeta('name', 'twitter:card', seo.image ? 'summary_large_image' : 'summary');
    this.setCanonical(url);
    this.setJsonLd(seo.jsonLd);
  }

  private seoOf(route: ActivatedRouteSnapshot): PageSeo {
    const seo = route.data[SEO_DATA_KEY] as RouteSeo | undefined;
    if (typeof seo === 'function') {
      return runInInjectionContext(this.injector, () => seo(route));
    }
    return seo ?? {};
  }

  private setMeta(attribute: 'name' | 'property', key: string, content: string | null): void {
    if (content === null) {
      this.meta.removeTag(`${attribute}="${key}"`);
    } else {
      this.meta.updateTag({ [attribute]: key, content });
    }
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }

  private setJsonLd(data: object | undefined): void {
    let script = this.document.getElementById(JSON_LD_ID);
    if (!data) {
      script?.remove();
      return;
    }
    if (!script) {
      script = this.document.createElement('script');
      script.id = JSON_LD_ID;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    // "<" escaped: a recipe text containing "</script>" cannot close the tag
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }
}

function deepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? deepestChild(route.firstChild) : route;
}
