import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { listCapEntries } from '../../core/api/generated/fn/mon-cap/list-cap-entries';
import { listObservations } from '../../core/api/generated/fn/mon-cap/list-observations';
import { CapEntryResponse } from '../../core/api/generated/models/cap-entry-response';
import { PageResponseObservationResponse } from '../../core/api/generated/models/page-response-observation-response';
import { PageSeo, markdownPathOf } from '../../core/seo/page-seo';
import { CAP_PATH, OBSERVATIONS_PATH } from '../../shared/routing/links';

export const OBSERVATIONS_PER_PAGE = 12;

export const capEntriesResolver: ResolveFn<CapEntryResponse[]> = () =>
  inject(Api)
    .invoke(listCapEntries)
    .catch(() => []);

/** ?page=2, from 1. */
export const observationsResolver: ResolveFn<PageResponseObservationResponse> = (route) =>
  inject(Api).invoke(listObservations, {
    page: Math.max(0, (Number(route.queryParamMap.get('page')) || 1) - 1),
    size: OBSERVATIONS_PER_PAGE,
  });

/** Empty, it is not worth indexing. */
export function capSeo(route: ActivatedRouteSnapshot): PageSeo {
  const entries = (route.data['entries'] as CapEntryResponse[] | undefined) ?? [];
  return {
    title: 'Mon CAP',
    description: 'Le carnet de route de Yona vers son CAP Pâtisserie : les étapes, les épreuves et les avancées, date par date',
    markdownPath: markdownPathOf(CAP_PATH),
    noIndex: entries.length === 0,
  };
}

export function observationsSeo(route: ActivatedRouteSnapshot): PageSeo {
  const observations = route.data['observations'] as PageResponseObservationResponse | undefined;
  return {
    title: 'Mes observations · Mon CAP',
    description: 'Ce que Yona remarque en cuisinant pendant son CAP Pâtisserie : réussites, ratés et ajustements, recette par recette',
    markdownPath: markdownPathOf(OBSERVATIONS_PATH),
    noIndex: !observations?.totalElements,
  };
}
