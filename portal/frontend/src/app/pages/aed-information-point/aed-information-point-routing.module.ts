// Wykaz AED (HackNation 2026): trasy jak w dga-information-point – '!aed' → '!list-aed' → '!table'.
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LocalizeRouterModule } from '@gilsdav/ngx-translate-router';

import { AedInformationPointTablePageComponent } from '@app/pages/aed-information-point/aed-information-point-table-page/aed-information-point-table-page.component';
import { AedInformationPointTableComponent } from '@app/pages/aed-information-point/aed-information-point-table/aed-information-point-table.component';
import { breadcrumbsAedInformationPointTableDataResolverService } from '@app/shared/breadcrumbs/resolvers/breadcrumbs-aed-information-point-table-data-resolver.service';

const routes: Routes = [
  { path: '', redirectTo: '!list-aed', pathMatch: 'full' },
  {
    path: '!list-aed',
    component: AedInformationPointTablePageComponent,
    children: [
      { path: '', redirectTo: '!table', pathMatch: 'full' },
      {
        path: '!table',
        component: AedInformationPointTableComponent,
      },
    ],
    data: { breadcrumbs: { translationKey: 'AedInformationPoint.List' } },
    resolve: { post: breadcrumbsAedInformationPointTableDataResolverService },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes), LocalizeRouterModule.forChild(routes)],
  exports: [RouterModule, LocalizeRouterModule],
})
export class AedInformationPointRoutingModule {}
