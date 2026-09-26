import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ViewChild } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchFilterField, SearchPageActionEvent, SearchPageComponent, SearchResultColumn } from '../../shared/search-page.component';

interface StructureDepartment {
  id: number;
  codiceRegione?: string;
  regione?: string;
  codiceAsl?: string;
  asl?: string;
  codiceStruttura?: string;
  struttura?: string;
  codiceDisciplina?: string;
  disciplina?: string;
  indirizzo?: string;
  imported: boolean;
}

@Component({
  selector: 'app-structure-departments-management',
  standalone: true,
  imports: [CommonModule, SearchPageComponent],
  template: `
    <app-search-page
      [titleKey]="'structureDepartments.title'"
      [subtitleKey]="'structureDepartments.subtitle'"
      [emptyStateKey]="'structureDepartments.search.noResults'"
      [filters]="filters"
      [columns]="columns"
      [fetchResults]="fetchResults"
      [showCreateAction]="false"
      (actionColumn)="onAction($event)"
    />
  `
})
export class StructureDepartmentsManagementComponent {
  @ViewChild(SearchPageComponent) private searchPage?: SearchPageComponent<StructureDepartment>;

  readonly filters: SearchFilterField[] = [
    { key: 'regionCode', labelKey: 'structureDepartments.filter.regionCode', type: 'text' },
    { key: 'aslCode', labelKey: 'structureDepartments.filter.aslCode', type: 'text' },
    { key: 'structureCode', labelKey: 'structureDepartments.filter.hospital', type: 'text' },
    { key: 'imported', labelKey: 'hospital.filter.imported', type: 'select', options: [
      { value: 'all', labelKey: 'hospital.filter.status.all' },
      { value: 'imported', labelKey: 'hospital.filter.status.imported' },
      { value: 'notImported', labelKey: 'hospital.filter.status.notImported' }
    ] }
  ];

  readonly columns: SearchResultColumn<StructureDepartment>[] = [
    { key: 'regione', labelKey: 'structureDepartments.column.region', formatter: (row) => row.regione ? `${row.regione} (${row.codiceRegione || ''})` : row.codiceRegione || '-' },
    { key: 'asl', labelKey: 'structureDepartments.column.asl', formatter: (row) => row.asl ? `${row.asl} (${row.codiceAsl || ''})` : row.codiceAsl || '-' },
    { key: 'struttura', labelKey: 'structureDepartments.column.hospital', formatter: (row) => row.struttura ? `${row.struttura} (${row.codiceStruttura || ''})` : row.codiceStruttura || '-' },
    { key: 'codiceStruttura', labelKey: 'structureDepartments.column.code' },
    { key: 'disciplina', labelKey: 'structureDepartments.column.department', formatter: (row) => row.disciplina || row.codiceDisciplina || '-' },
    { key: 'indirizzo', labelKey: 'structureDepartments.column.address' },
    { key: 'action', labelKey: 'search.actions', formatter: (row) => row.imported ? 'Disassocia' : 'Associa', action: (row) => row.imported ? 'secondary' : 'primary' }
  ];

  readonly fetchResults = (filters: Record<string, string>): Observable<StructureDepartment[]> =>
    this.http.get<StructureDepartment[]>(`${environment.apiBaseUrl}/structure-departments/overview`, { params: filters }).pipe(
      map((records) => records.filter((row) => !filters['imported'] || filters['imported'] === 'all' || (filters['imported'] === 'imported' ? row.imported : !row.imported)))
    );

  constructor(private readonly http: HttpClient) {}

  onAction(event: { column: SearchResultColumn<StructureDepartment>; event: SearchPageActionEvent<StructureDepartment> }): void {
    const row = event.event.row;
    const params = { codiceStruttura: row.codiceStruttura || '', codiceDisciplina: row.codiceDisciplina || '' };
    const request = row.imported
      ? this.http.delete(`${environment.apiBaseUrl}/structure-departments`, { params })
      : this.http.post(`${environment.apiBaseUrl}/structure-departments/import`, params);
    request.subscribe(() => this.searchPage?.reload(false));
  }
}
