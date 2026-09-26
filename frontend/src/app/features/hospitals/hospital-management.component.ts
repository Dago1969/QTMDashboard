import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ViewChild } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchFilterField, SearchPageActionEvent, SearchPageComponent, SearchResultColumn } from '../../shared/search-page.component';

interface HospitalRecord {
  id: number;
  anno?: number;
  codiceRegione?: string;
  regione?: string;
  codiceAsl?: string;
  asl?: string;
  codiceStruttura?: string;
  struttura?: string;
  comune?: string;
  siglaProvincia?: string;
  tipoStruttura?: string;
  imported: boolean;
}

@Component({
  selector: 'app-hospital-management',
  standalone: true,
  imports: [CommonModule, SearchPageComponent],
  template: `
    <app-search-page
      [titleKey]="'dashboard.menu.hospital'"
      [subtitleKey]="'hospital.management.subtitle'"
      [emptyStateKey]="'search.noResults'"
      [filters]="filters"
      [columns]="columns"
      [fetchResults]="fetchResults"
      [showCreateAction]="false"
      (actionColumn)="onAction($event)"
    />
  `
})
export class HospitalManagementComponent {
  @ViewChild(SearchPageComponent) private searchPage?: SearchPageComponent<HospitalRecord>;

  readonly filters: SearchFilterField[] = [
    { key: 'id', labelKey: 'hospital.filter.id', type: 'number' },
    { key: 'regionCode', labelKey: 'hospital.filter.regionCode', type: 'text' },
    { key: 'provinceCode', labelKey: 'patients.field.province', type: 'text' },
    { key: 'aslCode', labelKey: 'hospital.filter.aslCode', type: 'text' },
    { key: 'name', labelKey: 'hospital.filter.name', type: 'text' },
    { key: 'code', labelKey: 'hospital.filter.code', type: 'text' },
    { key: 'type', labelKey: 'hospital.filter.type', type: 'text' },
    { key: 'imported', labelKey: 'hospital.filter.imported', type: 'select', options: [
      { value: 'all', labelKey: 'hospital.filter.status.all' },
      { value: 'imported', labelKey: 'hospital.filter.status.imported' },
      { value: 'notImported', labelKey: 'hospital.filter.status.notImported' }
    ] }
  ];

  readonly columns: SearchResultColumn<HospitalRecord>[] = [
    { key: 'anno', labelKey: 'hospital.column.year' },
    { key: 'regione', labelKey: 'hospital.column.region', formatter: (row) => row.regione ? `${row.regione} (${row.codiceRegione || ''})` : row.codiceRegione || '-' },
    { key: 'asl', labelKey: 'hospital.column.asl', formatter: (row) => row.asl ? `${row.asl} (${row.codiceAsl || ''})` : row.codiceAsl || '-' },
    { key: 'codiceStruttura', labelKey: 'hospital.column.code' },
    { key: 'struttura', labelKey: 'hospital.column.name' },
    { key: 'comune', labelKey: 'hospital.column.municipality' },
    { key: 'tipoStruttura', labelKey: 'hospital.column.type' },
    { key: 'action', labelKey: 'search.actions', formatter: (row) => row.imported ? 'Disassocia' : 'Associa', action: (row) => row.imported ? 'secondary' : 'primary' }
  ];

  readonly fetchResults = (filters: Record<string, string>): Observable<HospitalRecord[]> =>
    this.http.get<HospitalRecord[]>(`${environment.apiBaseUrl}/hospital/overview`, { params: filters }).pipe(
      map((records) => records.filter((row) => !filters['imported'] || filters['imported'] === 'all' || (filters['imported'] === 'imported' ? row.imported : !row.imported)))
    );

  constructor(private readonly http: HttpClient) {}

  onAction(event: { column: SearchResultColumn<HospitalRecord>; event: SearchPageActionEvent<HospitalRecord> }): void {
    const row = event.event.row;
    const request = row.imported
      ? this.http.delete(`${environment.apiBaseUrl}/hospital/${row.id}`)
      : this.http.post(`${environment.apiBaseUrl}/hospital/import`, { sourceIds: [row.id] });
    request.subscribe(() => this.searchPage?.reload(false));
  }
}
