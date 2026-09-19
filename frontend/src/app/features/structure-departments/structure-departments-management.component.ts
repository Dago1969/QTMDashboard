import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Select2 } from 'ng-select2-component';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';

interface ProblemDetailPayload {
  detail?: string;
  message?: string;
}

interface FilterOption {
  code: string;
  label: string;
  regionCode?: string;
  aslCode?: string;
}

interface StructureDepartmentFilterOptions {
  regions: FilterOption[];
  asls: FilterOption[];
  hospitals: FilterOption[];
}

interface DisciplineOption {
  codice: string;
  disciplina: string;
}

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

interface Select2Option {
  value: string;
  label: string;
  id: string;
}

interface Select2UpdatePayload {
  value: unknown;
}

@Component({
  selector: 'app-structure-departments-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTableModule, MatSortModule, MatPaginatorModule, Select2],
  template: `
    <div class="card dashboard-content-card">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('structureDepartments.title') }}</h2>
          <p>{{ t('structureDepartments.subtitle') }}</p>
        </div>
      </div>

      <p class="dashboard-selection-info hospital-management-info">{{ t('structureDepartments.detail') }}</p>

      <section class="search-filters-panel">
        <div class="asl-filters-grid hospital-filters-grid">
          <div class="asl-filter-field">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.regionCode') }}</span>
            <ng-select2
              class="qtm-select2-field"
              [(ngModel)]="filters.regionCode"
              name="regionCode"
              [data]="regionSelect2Data"
              [placeholder]="t('crud.select.all')"
              [displaySearchStatus]="'always'"
              [resettable]="true"
              (update)="onRegionUpdate($event)"
            ></ng-select2>
          </div>
          <div class="asl-filter-field">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.aslCode') }}</span>
            <ng-select2
              class="qtm-select2-field"
              [(ngModel)]="filters.aslCode"
              name="aslCode"
              [data]="aslSelect2Data"
              [placeholder]="t('crud.select.all')"
              [displaySearchStatus]="'always'"
              [resettable]="true"
              (update)="onAslUpdate($event)"
            ></ng-select2>
          </div>
          <div class="asl-filter-field asl-filter-field-wide">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.hospital') }}</span>
            <ng-select2
              class="qtm-select2-field"
              [(ngModel)]="filters.hospitalCode"
              name="hospitalCode"
              [data]="hospitalSelect2Data"
              [placeholder]="t('crud.select.all')"
              [displaySearchStatus]="'always'"
              [resettable]="true"
              (update)="onHospitalUpdate($event)"
            ></ng-select2>
          </div>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.imported') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.imported" (ngModelChange)="onImportedChange()">
              <option value="all">{{ t('hospital.filter.status.all') }}</option>
              <option value="imported">{{ t('hospital.filter.status.imported') }}</option>
              <option value="notImported">{{ t('hospital.filter.status.notImported') }}</option>
            </select>
          </label>
        </div>
        <div class="asl-filter-actions">
          <button class="btn btn-primary" type="button" (click)="loadOverview()">{{ t('crud.actions.search') }}</button>
          <button class="btn btn-outline" type="button" (click)="resetFilters()">{{ t('crud.actions.reset') }}</button>
        </div>
      </section>

      <section class="modern-table asl-table-panel">
        <div *ngIf="message" class="alert" [class.alert-success]="messageType === 'success'" [class.alert-danger]="messageType === 'error'">{{ message }}</div>

        <div class="table-responsive asl-table-wrapper">
          <table
            mat-table
            [dataSource]="dataSource"
            matSort
            matSortActive="region"
            matSortDirection="asc"
            class="search-table asl-search-table structure-departments-table"
          >
            <ng-container matColumnDef="region">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [sortActionDescription]="t('structureDepartments.sort.region')"
              >
                {{ t('structureDepartments.column.region') }}
              </th>
              <td mat-cell *matCellDef="let row">{{ formatRegion(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="asl">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [sortActionDescription]="t('structureDepartments.sort.asl')"
              >
                {{ t('structureDepartments.column.asl') }}
              </th>
              <td mat-cell *matCellDef="let row">{{ formatAsl(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="hospital">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [sortActionDescription]="t('structureDepartments.sort.hospital')"
              >
                {{ t('structureDepartments.column.hospital') }}
              </th>
              <td mat-cell *matCellDef="let row">{{ formatHospital(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="code">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [sortActionDescription]="t('structureDepartments.sort.code')"
              >
                {{ t('structureDepartments.column.code') }}
              </th>
              <td mat-cell *matCellDef="let row">{{ row.codiceStruttura || '-' }}</td>
            </ng-container>

            <ng-container matColumnDef="department">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [sortActionDescription]="t('structureDepartments.sort.department')"
              >
                {{ t('structureDepartments.column.department') }}
              </th>
              <td mat-cell *matCellDef="let row">{{ formatDepartment(row) }}</td>
            </ng-container>

            <ng-container matColumnDef="address">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [sortActionDescription]="t('structureDepartments.sort.address')"
              >
                {{ t('structureDepartments.column.address') }}
              </th>
              <td mat-cell *matCellDef="let row">{{ row.indirizzo || '-' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="asl-actions-column">{{ t('search.actions') }}</th>
              <td mat-cell *matCellDef="let row" class="asl-actions-cell">
                <button *ngIf="!row.imported" class="btn btn-primary btn-sm" type="button" (click)="importRow(row)">{{ t('structureDepartments.action.associate') }}</button>
                <button *ngIf="row.imported" class="btn btn-secondary btn-sm" type="button" (click)="remove(row)">{{ t('structureDepartments.action.disassociate') }}</button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns; trackBy: trackById"></tr>
            <tr class="mat-mdc-row" *matNoDataRow>
              <td class="asl-empty-cell" [attr.colspan]="displayedColumns.length">{{ t('structureDepartments.search.noResults') }}</td>
            </tr>
          </table>

          <mat-paginator
            class="structure-departments-paginator"
            [pageSize]="pageSize"
            [pageSizeOptions]="pageSizeOptions"
            [selectConfig]="paginatorSelectConfig"
            showFirstLastButtons
            [attr.aria-label]="t('structureDepartments.pagination.aria')"
          ></mat-paginator>
        </div>
      </section>
    </div>
  `
})
export class StructureDepartmentsManagementComponent implements AfterViewInit {
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns: string[] = ['region', 'asl', 'hospital', 'code', 'department', 'address', 'actions'];
  readonly pageSizeOptions: number[] = [10, 25, 50, 100];
  readonly pageSize = 10;
  readonly paginatorSelectConfig = { panelClass: 'structure-departments-page-size-panel' };

  filters = {
    regionCode: '',
    aslCode: '',
    hospitalCode: '',
    imported: 'all' as 'all' | 'imported' | 'notImported'
  };
  allRecords: StructureDepartment[] = [];
  dataSource = new MatTableDataSource<StructureDepartment>([]);
  allRegionOptions: FilterOption[] = [];
  allAslOptions: FilterOption[] = [];
  allHospitalOptions: FilterOption[] = [];
  regionOptions: FilterOption[] = [];
  aslOptions: FilterOption[] = [];
  hospitalOptions: FilterOption[] = [];
  regionSelect2Data: Select2Option[] = [];
  aslSelect2Data: Select2Option[] = [];
  hospitalSelect2Data: Select2Option[] = [];
  disciplineLabels: Record<string, string> = {};
  translations: Record<string, string> = {};
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(
    private readonly http: HttpClient,
    private readonly i18n: I18nPropertiesService,
    private readonly paginatorIntl: MatPaginatorIntl
  ) {
    forkJoin({
      translations: this.i18n.loadTranslations(navigator.language),
      disciplines: this.http
        .get<DisciplineOption[]>('/structure-departments-disciplines.json')
        .pipe(catchError(() => of([] as DisciplineOption[])))
    }).subscribe(({ translations, disciplines }) => {
      this.translations = translations;
      this.configurePaginatorIntl();
      this.disciplineLabels = disciplines.reduce<Record<string, string>>((labels, discipline) => {
        if (discipline.codice && discipline.disciplina) {
          labels[discipline.codice] = discipline.disciplina;
        }
        return labels;
      }, {});
      this.loadFilterOptions();
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.getSortValue(row, column);
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  onRegionChange(): void {
    // update available ASL/hospitals for selected region and apply filter immediately
    this.aslOptions = this.getAvailableAslOptions();
    if (this.filters.aslCode && !this.aslOptions.some((option) => option.code === this.filters.aslCode)) {
      this.filters.aslCode = '';
    }
    this.hospitalOptions = this.getAvailableHospitalOptions();
    if (this.filters.hospitalCode && !this.hospitalOptions.some((option) => option.code === this.filters.hospitalCode)) {
      this.filters.hospitalCode = '';
    }
    this.refreshDependentSelect2Data();
    this.loadOverview();
  }

  onRegionUpdate(event: Select2UpdatePayload): void {
    this.filters.regionCode = this.normalizeRegionCode(this.extractSingleValue(event.value)) ?? '';
    this.onRegionChange();
  }

  onAslChange(): void {
    this.hospitalOptions = this.getAvailableHospitalOptions();
    if (this.filters.hospitalCode && !this.hospitalOptions.some((option) => option.code === this.filters.hospitalCode)) {
      this.filters.hospitalCode = '';
    }
    this.hospitalSelect2Data = this.toSelect2Data(this.hospitalOptions, this.t('crud.select.all'));
    this.loadOverview();
  }

  onAslUpdate(event: Select2UpdatePayload): void {
    this.filters.aslCode = this.normalizeValue(this.extractSingleValue(event.value)) ?? '';
    this.onAslChange();
  }

  onHospitalChange(): void {
    this.loadOverview();
  }

  onHospitalUpdate(event: Select2UpdatePayload): void {
    this.filters.hospitalCode = this.normalizeValue(this.extractSingleValue(event.value)) ?? '';
    this.onHospitalChange();
  }

  onImportedChange(): void {
    this.loadOverview();
  }

  toSelect2Data(options: FilterOption[], allLabel: string): Select2Option[] {
    return [{ value: '', label: allLabel, id: '' }, ...options.map((option) => ({ value: String(option.code), label: option.label, id: String(option.code) }))];
  }

  resetFilters(): void {
    this.filters = {
      regionCode: '',
      aslCode: '',
      hospitalCode: '',
      imported: 'all'
    };
    this.refreshAvailableOptions();
    this.loadOverview();
  }

  importRow(row: StructureDepartment): void {
    if (!row.codiceStruttura || !row.codiceDisciplina) {
      return;
    }
    this.http
      .post(`${environment.apiBaseUrl}/structure-departments/import`, {
        codiceStruttura: row.codiceStruttura,
        codiceDisciplina: row.codiceDisciplina
      })
      .subscribe({
        next: () => {
          this.showMessage('structureDepartments.messages.addSuccess', 'success');
          this.loadOverview();
        },
        error: (error: { error?: ProblemDetailPayload }) => this.showErrorMessage(error, 'structureDepartments.messages.addError')
      });
  }

  remove(row: StructureDepartment): void {
    if (!row.codiceStruttura || !row.codiceDisciplina) {
      return;
    }
    this.http
      .delete(`${environment.apiBaseUrl}/structure-departments`, {
        params: { codiceStruttura: row.codiceStruttura, codiceDisciplina: row.codiceDisciplina }
      })
      .subscribe({
        next: () => {
          this.showMessage('structureDepartments.messages.removeSuccess', 'success');
          this.loadOverview();
        },
        error: (error: { error?: ProblemDetailPayload }) => this.showErrorMessage(error, 'structureDepartments.messages.removeError')
      });
  }

  trackById(_: number, item: StructureDepartment): number {
    return item.id;
  }

  formatDepartment(row: StructureDepartment): string {
    const disciplineCode = row.codiceDisciplina?.trim();
    const disciplineLabel = row.disciplina?.trim() || (disciplineCode ? this.disciplineLabels[disciplineCode] : undefined);
    if (disciplineLabel && disciplineCode) {
      return `${disciplineLabel} (${disciplineCode})`;
    }
    return disciplineLabel || disciplineCode || '-';
  }

  formatRegion(row: StructureDepartment): string {
    return row.regione ? `${row.regione} (${row.codiceRegione})` : (row.codiceRegione || '-');
  }

  formatAsl(row: StructureDepartment): string {
    return row.asl ? `${row.asl} (${row.codiceAsl})` : (row.codiceAsl || '-');
  }

  formatHospital(row: StructureDepartment): string {
    return row.struttura ? `${row.struttura} (${row.codiceStruttura})` : (row.codiceStruttura || '-');
  }

  loadOverview(): void {
    const params: Record<string, string> = {};
    if (this.filters.regionCode) {
      params['regionCode'] = this.filters.regionCode;
    }
    if (this.filters.aslCode) {
      params['aslCode'] = this.filters.aslCode;
    }
    if (this.filters.hospitalCode) {
      params['structureCode'] = this.filters.hospitalCode;
    }
    this.http.get<StructureDepartment[]>(`${environment.apiBaseUrl}/structure-departments/overview`, { params }).subscribe({
      next: (data) => {
        this.allRecords = this.applyImportedFilter(data ?? []);
        this.dataSource.data = this.allRecords;
        if (this.paginator) {
          this.paginator.firstPage();
        }
        this.showMessage('', 'success');
      },
      error: (error: { error?: ProblemDetailPayload }) => this.showErrorMessage(error, 'structureDepartments.messages.loadError')
    });
  }

  private applyImportedFilter(records: StructureDepartment[]): StructureDepartment[] {
    if (this.filters.imported === 'imported') {
      return records.filter((record) => record.imported);
    }
    if (this.filters.imported === 'notImported') {
      return records.filter((record) => !record.imported);
    }
    return records;
  }

  private loadFilterOptions(): void {
    // Load regions from Ticket service and other filter options (asls/hospitals) from dashboard backend
    forkJoin({
      regions: this.http.get<Array<{ id: number; name: string; regionCode?: string }>>(`${environment.apiBaseUrl}/geography/regions`).pipe(catchError(() => of([] as Array<{ id: number; name: string; regionCode?: string }>))),
      others: this.http.get<StructureDepartmentFilterOptions>(`${environment.apiBaseUrl}/structure-departments/filter-options`).pipe(catchError(() => of({ regions: [], asls: [], hospitals: [] } as StructureDepartmentFilterOptions)))
    }).subscribe({
      next: ({ regions, others }) => {
        // map ticket regions to FilterOption shape (use regionCode as code when available)
        const mappedRegions: FilterOption[] = (regions || []).map((r) => ({
          code: r.regionCode ? String(r.regionCode) : String(r.id),
          label: r.name,
          regionCode: r.regionCode ? String(r.regionCode) : undefined
        }));
        // normalize region options from both sources and deduplicate by normalized code
        const normalizedMapped = mappedRegions.map((option) => this.normalizeRegionOption(option));
        const normalizedOthersRegions = (others.regions || []).map((option) => this.normalizeRegionOption(option));
        this.allRegionOptions = this.uniqueOptions(normalizedMapped.concat(normalizedOthersRegions));
        // normalize ASL and hospital options (dependent) so codes/regionCodes are comparable
        this.allAslOptions = this.uniqueAslOptions((others.asls || []).map((option) => this.normalizeDependentOption(option)));
        this.allHospitalOptions = this.uniqueOptions((others.hospitals || []).map((option) => this.normalizeDependentOption(option)));
        this.refreshAvailableOptions();
        this.loadOverview();
      },
      error: (error: { error?: ProblemDetailPayload }) => this.showErrorMessage(error, 'structureDepartments.messages.loadError')
    });
  }

  private refreshAvailableOptions(): void {
    this.regionOptions = this.allRegionOptions;
    this.aslOptions = this.getAvailableAslOptions();
    this.hospitalOptions = this.getAvailableHospitalOptions();
    this.refreshSelect2Data();
  }

  private refreshSelect2Data(): void {
    const allLabel = this.t('crud.select.all');
    this.regionSelect2Data = this.toSelect2Data(this.regionOptions, allLabel);
    this.refreshDependentSelect2Data();
  }

  private refreshDependentSelect2Data(): void {
    const allLabel = this.t('crud.select.all');
    this.aslSelect2Data = this.toSelect2Data(this.aslOptions, allLabel);
    this.hospitalSelect2Data = this.toSelect2Data(this.hospitalOptions, allLabel);
  }

  private getAvailableAslOptions(): FilterOption[] {
    if (!this.filters.regionCode) {
      return this.uniqueOptions(this.allAslOptions);
    }
    const region = this.filters.regionCode;
    // ASL that explicitly declare the same region
    const explicit = this.allAslOptions.filter((option) => option.regionCode === region);
    // ASL that have at least one hospital in the selected region
    const hospitalsInRegionAslCodes = new Set(
      this.allHospitalOptions.filter((h) => h.regionCode === region).map((h) => h.aslCode).filter(Boolean)
    );
    const viaHospitals = this.allAslOptions.filter((option) => hospitalsInRegionAslCodes.has(option.aslCode));
    return this.uniqueOptions(explicit.concat(viaHospitals));
  }

  private getAvailableHospitalOptions(): FilterOption[] {
    return this.uniqueOptions(
      this.allHospitalOptions.filter(
        (option) =>
          (!this.filters.regionCode || option.regionCode === this.filters.regionCode) &&
          (!this.filters.aslCode || option.aslCode === this.filters.aslCode)
      )
    );
  }

  private uniqueOptions(options: FilterOption[]): FilterOption[] {
    return options
      .filter((option, index, source) => !!option.code && source.findIndex((candidate) => candidate.code === option.code) === index)
      .sort((first, second) => first.label.localeCompare(second.label));
  }

  private uniqueAslOptions(options: FilterOption[]): FilterOption[] {
    return options
      .filter(
        (option, index, source) =>
          !!option.code &&
          source.findIndex(
            (candidate) => candidate.code === option.code && candidate.regionCode === option.regionCode
          ) === index
      )
      .sort((first, second) => first.label.localeCompare(second.label));
  }

  private normalizeRegionOption(option: FilterOption): FilterOption {
    const regionCode = this.normalizeRegionCode(option.regionCode ?? option.code);
    return {
      ...option,
      code: regionCode ?? '',
      regionCode,
      label: this.formatRegionLabel(option.label, regionCode)
    };
  }

  private normalizeDependentOption(option: FilterOption): FilterOption {
    return {
      ...option,
      code: this.normalizeValue(option.code) ?? '',
      regionCode: this.normalizeRegionCode(option.regionCode),
      aslCode: this.normalizeValue(option.aslCode)
    };
  }

  private formatRegionLabel(label: string, regionCode?: string): string {
    const normalizedLabel = this.normalizeValue(label) ?? '';
    if (!regionCode || !normalizedLabel || /\([^)]*\)\s*$/.test(normalizedLabel)) {
      return normalizedLabel;
    }
    return `${normalizedLabel} (${regionCode})`;
  }

  private normalizeRegionCode(value?: string): string | undefined {
    const normalizedValue = this.normalizeValue(value);
    if (!normalizedValue) {
      return undefined;
    }
    return /^\d+$/.test(normalizedValue) ? normalizedValue.padStart(2, '0') : normalizedValue;
  }

  private normalizeValue(value?: string): string | undefined {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : undefined;
  }

  private extractSingleValue(value: unknown): string {
    if (Array.isArray(value)) {
      const first = value[0];
      return first === null || first === undefined ? '' : String(first);
    }
    return value === null || value === undefined ? '' : String(value);
  }

  private getSortValue(row: StructureDepartment, column: string): string {
    switch (column) {
      case 'region':
        return this.normalizeSortValue(this.formatRegion(row));
      case 'asl':
        return this.normalizeSortValue(this.formatAsl(row));
      case 'hospital':
        return this.normalizeSortValue(this.formatHospital(row));
      case 'code':
        return this.normalizeSortValue(row.codiceStruttura);
      case 'department':
        return this.normalizeSortValue(this.formatDepartment(row));
      case 'address':
        return this.normalizeSortValue(row.indirizzo);
      default:
        return '';
    }
  }

  private normalizeSortValue(value?: string): string {
    return value?.trim().toLocaleLowerCase() ?? '';
  }

  private configurePaginatorIntl(): void {
    this.paginatorIntl.itemsPerPageLabel = this.t('structureDepartments.pagination.itemsPerPage');
    this.paginatorIntl.nextPageLabel = this.t('structureDepartments.pagination.nextPage');
    this.paginatorIntl.previousPageLabel = this.t('structureDepartments.pagination.previousPage');
    this.paginatorIntl.firstPageLabel = this.t('structureDepartments.pagination.firstPage');
    this.paginatorIntl.lastPageLabel = this.t('structureDepartments.pagination.lastPage');
    this.paginatorIntl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
      if (length === 0 || pageSize === 0) {
        return `0 ${this.t('structureDepartments.pagination.of')} ${length}`;
      }
      const startIndex = page * pageSize;
      const endIndex = Math.min(startIndex + pageSize, length);
      return `${startIndex + 1} - ${endIndex} ${this.t('structureDepartments.pagination.of')} ${length}`;
    };
    this.paginatorIntl.changes.next();
  }

  private showErrorMessage(error: { error?: ProblemDetailPayload }, fallbackKey: string): void {
    this.message = error.error?.detail || error.error?.message || this.t(fallbackKey);
    this.messageType = 'error';
    window.setTimeout(() => (this.message = ''), 5000);
  }

  private showMessage(key: string, type: 'success' | 'error'): void {
    this.message = key ? this.t(key) : '';
    this.messageType = type;
    if (key) {
      window.setTimeout(() => (this.message = ''), 5000);
    }
  }
}
