// Wykaz AED (HackNation 2026): kopia breadcrumbs-dga-information-point-table-data-resolver – dane z /aed-aggregated.
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { combineLatest, EMPTY, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { CmsService } from '@app/services/cms.service';
import { DatasetService } from '@app/services/dataset.service';
import { AedService } from '@app/services/aed.service';

export const breadcrumbsAedInformationPointTableDataResolverService = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const aedService = inject(AedService);
  const datasetService = inject(DatasetService);
  const cmsService = inject(CmsService);
  const router = inject(Router);

  const getMoreData = (data): Observable<any> => {
    const lang = route.queryParams.lang;
    const url = state.url.substring(3);
    const slicedUrl = url.slice(0, url.lastIndexOf('/'));
    const rev = route.queryParams.rev;

    return combineLatest([
      of(data),
      datasetService.getResourceById(data.resource_id),
      datasetService.getDatasetsStats(data.dataset_id, data.dataset_slug),
      // Wykaz AED: strona CMS jest opcjonalna (bez niej tytuł i opis pochodzą z tłumaczeń)
      cmsService.getLandingPage(slicedUrl, lang, rev).pipe(catchError(() => of(null))),
    ]).pipe(
      map(([resData, resource, stats, cms]) => {
        return {
          resData,
          resource,
          stats,
          cms,
        };
      }),
    );
  };

  return aedService.getAedAggregatedData().pipe(
    switchMap((responseData) => getMoreData(responseData)),
    catchError((err) => {
      console.warn("Couldn't load data");
      router.navigate(['/']).then();
      return EMPTY;
    }),
  );
};
