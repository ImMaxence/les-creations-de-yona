import { ActivatedRouteSnapshot } from '@angular/router';
import { ShopPage } from '../../core/api/generated/models/shop-page';
import { PageSeo } from '../../core/seo/page-seo';

/** For the people close to Yona, nothing for search engines; once open to all, found like any page. */
export function shopSeo(route: ActivatedRouteSnapshot): PageSeo {
  const shop = route.data['shop'] as ShopPage | undefined;
  return shop?.mode === 'OPEN'
    ? { title: 'Boutique', description: 'Les pâtisseries de Yona à commander : boîtes de cookies, tartes, entremets' }
    : { title: 'Boutique', noIndex: true };
}
