import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getShop } from '../../core/api/generated/fn/shop/get-shop';
import { trackOrder } from '../../core/api/generated/fn/shop/track-order';
import { OrderTracking } from '../../core/api/generated/models/order-tracking';
import { ShopPage } from '../../core/api/generated/models/shop-page';
import { NOT_FOUND_PATH } from '../recipe/recipe.resolver';

export const shopResolver: ResolveFn<ShopPage> = () => inject(Api).invoke(getShop);

/** An unknown link, or an order erased: the 404 page. */
export const orderTrackingResolver: ResolveFn<OrderTracking> = async (route) => {
  const router = inject(Router);
  try {
    return await inject(Api).invoke(trackOrder, { token: route.paramMap.get('token')! });
  } catch (error) {
    if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400)) {
      return new RedirectCommand(router.parseUrl(NOT_FOUND_PATH), { skipLocationChange: true });
    }
    throw error;
  }
};
