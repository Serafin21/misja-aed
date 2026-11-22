// Wykaz AED (HackNation 2026): kopia DgaInformationPointTableComponent – tabela zasobu wykazu zbiorczego.
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ResourceTableNoFiltersComponent } from '@app/shared/resource-table-no-filters/resource-table-no-filters.component';

@Component({
  selector: 'app-aed-information-point-table',
  templateUrl: './aed-information-point-table.component.html',
  standalone: true,
  imports: [ResourceTableNoFiltersComponent],
})
export class AedInformationPointTableComponent implements OnInit {
  resourceId: string;
  tableTitle = '';
  pageTitle: string;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.resourceId = this.route.parent.snapshot.data['post'].resData.resource_id;
  }
}
