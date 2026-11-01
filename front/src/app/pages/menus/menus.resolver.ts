import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getMenu } from '../../core/api/generated/fn/menus/get-menu';
import { MenuDetail } from '../../core/api/generated/models/menu-detail';
import { WEBSITE_ID, itemList } from '../../core/seo/json-ld';
import { PageSeo, absoluteUrl, excerpt } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';
import { MENUS_PATH, menuLink, recipeLink } from '../../shared/routing/links';
import { NOT_FOUND_PATH } from '../recipe/recipe.resolver';

/** A published menu; an unknown or unpublished one shows the 404 page. */
export const menuResolver: ResolveFn<MenuDetail> = async (route) => {
  const router = inject(Router);
  try {
    return await inject(Api).invoke(getMenu, { slug: route.paramMap.get('slug')! });
  } catch (error) {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return new RedirectCommand(router.parseUrl(NOT_FOUND_PATH), { skipLocationChange: true });
    }
    throw error;
  }
};

/** Its recipes as a list (schema.org ItemList), each with its address. */
export function menuSeo(route: ActivatedRouteSnapshot): PageSeo {
  const menu = route.data['menu'] as MenuDetail;
  const path = menuLink(menu).join('/');
  return {
    title: `${menu.title} · Menus`,
    description: excerpt(
      menu.intro || `${menu.title} : ${menu.recipes.map((recipe) => recipe.title).join(', ')}. Des recettes maison`,
    ),
    canonicalPath: path,
    image: menu.imageId ? `/api/images/${menu.imageId}/1600.webp` : undefined,
    jsonLd: [
      {
        ...itemList(menu.recipes.map((recipe) => ({ name: recipe.title, path: recipeLink(recipe).join('/') }))),
        name: menu.title,
        url: absoluteUrl(path),
        isPartOf: { '@id': WEBSITE_ID },
      },
    ],
  };
}

/** The published menus as a list, each with its address. */
export function menusSeo(): PageSeo {
  const menus = inject(SiteData).menus();
  return {
    title: 'Menus',
    description: excerpt(
      'Des menus composés par Yona pour chaque occasion : fêtes, goûters, repas entre amis. Toutes les recettes à la liste de courses en un geste',
    ),
    canonicalPath: MENUS_PATH,
    jsonLd: menus.length
      ? [
          {
            ...itemList(menus.map((menu) => ({ name: menu.title, path: menuLink(menu).join('/') }))),
            name: 'Menus',
            url: absoluteUrl(MENUS_PATH),
            isPartOf: { '@id': WEBSITE_ID },
          },
        ]
      : undefined,
  };
}
