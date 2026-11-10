import { ActivatedRouteSnapshot } from '@angular/router';
import { ShopPage } from '../../core/api/generated/models/shop-page';
import { shopSeo } from './shop.seo';

function seoOf(mode: ShopPage['mode'] | null) {
  const shop = mode && ({ mode, open: mode !== 'CLOSED', products: [] } satisfies ShopPage);
  return shopSeo({ data: shop ? { shop } : {} } as unknown as ActivatedRouteSnapshot);
}

describe('shopSeo', () => {
  it('keeps the shop away from search engines while closed or for the close ones', () => {
    expect(seoOf('CLOSED').noIndex).toBe(true);
    expect(seoOf('FRIENDS').noIndex).toBe(true);
    expect(seoOf(null).noIndex).toBe(true);
  });

  it('lets it be found once open to all', () => {
    const seo = seoOf('OPEN');

    expect(seo.noIndex).toBeFalsy();
    expect(seo.description).toContain('commander');
  });
});
