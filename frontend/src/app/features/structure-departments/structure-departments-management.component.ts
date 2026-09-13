import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-structure-departments-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.regionCode') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.regionCode" (ngModelChange)="onRegionChange()">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let region of regionOptions" [value]="region.code">{{ region.label }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.aslCode') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.aslCode" (ngModelChange)="onAslChange()">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let asl of aslOptions" [value]="asl.code">{{ asl.label }}</option>
            </select>
          </label>
          <label class="asl-filter-field asl-filter-field-wide">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.hospital') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.hospitalCode" (ngModelChange)="onHospitalChange()">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let hospital of hospitalOptions" [value]="hospital.code">{{ hospital.label }}</option>
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
          <table class="search-table asl-search-table">
            <thead>
              <tr>
                <th>{{ t('structureDepartments.column.region') }}</th>
                <th>{{ t('structureDepartments.column.asl') }}</th>
                <th>{{ t('structureDepartments.column.hospital') }}</th>
                <th>{{ t('structureDepartments.column.code') }}</th>
                <th>{{ t('structureDepartments.column.department') }}</th>
                <th>{{ t('structureDepartments.column.address') }}</th>
                <th class="asl-actions-column">{{ t('search.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of allRecords; trackBy: trackById">
                <td>{{ row.regione ? row.regione + ' (' + row.codiceRegione + ')' : (row.codiceRegione || '-') }}</td>
                <td>{{ row.asl ? row.asl + ' (' + row.codiceAsl + ')' : (row.codiceAsl || '-') }}</td>
                <td>{{ row.struttura ? row.struttura + ' (' + row.codiceStruttura + ')' : (row.codiceStruttura || '-') }}</td>
                <td>{{ row.codiceStruttura || '-' }}</td>
                <td>{{ formatDepartment(row) }}</td>
                <td>{{ row.indirizzo || '-' }}</td>
                <td class="asl-actions-cell">
                  <button *ngIf="!row.imported" class="btn btn-primary btn-sm" type="button" (click)="importRow(row)">{{ t('structureDepartments.action.associate') }}</button>
                  <button *ngIf="row.imported" class="btn btn-secondary btn-sm" type="button" (click)="remove(row)">{{ t('structureDepartments.action.disassociate') }}</button>
                </td>
              </tr>
              <tr *ngIf="allRecords.length === 0">
                <td class="asl-empty-cell" colspan="7">{{ t('structureDepartments.search.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
})
export class StructureDepartmentsManagementComponent {
  filters = {
    regionCode: '',
    aslCode: '',
    hospitalCode: ''
  };
  allRecords: StructureDepartment[] = [];
  allRegionOptions: FilterOption[] = [];
  allAslOptions: FilterOption[] = [];
  allHospitalOptions: FilterOption[] = [];
  regionOptions: FilterOption[] = [];
  aslOptions: FilterOption[] = [];
  hospitalOptions: FilterOption[] = [];
  disciplineLabels: Record<string, string> = {};
  translations: Record<string, string> = {};
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(private readonly http: HttpClient, private readonly i18n: I18nPropertiesService) {
    forkJoin({
      translations: this.i18n.loadTranslations(navigator.language),
      disciplines: this.http
        .get<DisciplineOption[]>('/structure-departments-disciplines.json')
        .pipe(catchError(() => of([] as DisciplineOption[])))
    }).subscribe(({ translations, disciplines }) => {
      this.translations = translations;
      this.disciplineLabels = disciplines.reduce<Record<string, string>>((labels, discipline) => {
        if (discipline.codice && discipline.disciplina) {
          labels[discipline.codice] = discipline.disciplina;
        }
        return labels;
      }, {});
      this.loadFilterOptions();
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  onRegionChange(): void {
    this.aslOptions = this.getAvailableAslOptions();
    if (this.filters.aslCode && !this.aslOptions.some((option) => option.code === this.filters.aslCode)) {
      this.filters.aslCode = '';
    }
    this.hospitalOptions = this.getAvailableHospitalOptions();
    if (this.filters.hospitalCode && !this.hospitalOptions.some((option) => option.code === this.filters.hospitalCode)) {
      this.filters.hospitalCode = '';
    }
  }

  onAslChange(): void {
    this.hospitalOptions = this.getAvailableHospitalOptions();
    if (this.filters.hospitalCode && !this.hospitalOptions.some((option) => option.code === this.filters.hospitalCode)) {
      this.filters.hospitalCode = '';
    }
  }

  onHospitalChange(): void {
    this.loadOverview();
  }

  resetFilters(): void {
    this.filters = {
      regionCode: '',
      aslCode: '',
      hospitalCode: ''
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
        this.allRecords = data;
        this.showMessage('', 'success');
      },
      error: (error: { error?: ProblemDetailPayload }) => this.showErrorMessage(error, 'structureDepartments.messages.loadError')
    });
  }

  private loadFilterOptions(): void {
    this.http.get<StructureDepartmentFilterOptions>(`${environment.apiBaseUrl}/structure-departments/filter-options`).subscribe({
      next: (options) => {
        this.allRegionOptions = this.uniqueOptions(options.regions || []);
        this.allAslOptions = this.uniqueOptions(options.asls || []);
        this.allHospitalOptions = this.uniqueOptions(options.hospitals || []);
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
  }

  private getAvailableAslOptions(): FilterOption[] {
    return this.uniqueOptions(this.allAslOptions.filter((option) => !this.filters.regionCode || option.regionCode === this.filters.regionCode));
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
