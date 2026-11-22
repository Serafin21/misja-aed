// Wykaz AED (HackNation 2026): moduł jak DgaInformationPointModule – strona wykazu zbiorczego AED z tabelą zasobu.
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DatasetModule } from '@app/pages';
import { AedInformationPointRoutingModule } from '@app/pages/aed-information-point/aed-information-point-routing.module';
import { AedInformationPointTablePageComponent } from '@app/pages/aed-information-point/aed-information-point-table-page/aed-information-point-table-page.component';
import { AedInformationPointTableComponent } from '@app/pages/aed-information-point/aed-information-point-table/aed-information-point-table.component';
import { ResourceFilterModule } from '@app/shared/resource-filters/resource-filter.module';
import { SharedModule } from '@app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    AedInformationPointRoutingModule,
    TranslateModule,
    SharedModule,
    ResourceFilterModule,
    DatasetModule,
    AedInformationPointTablePageComponent,
    AedInformationPointTableComponent,
  ],
})
export class AedInformationPointModule {}
