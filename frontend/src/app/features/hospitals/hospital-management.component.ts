import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';

interface ProblemDetailPayload {
  detail?: string;
  message?: string;
}

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
  indirizzo?: string;
  hospitalTypeId?: number;
  tipoStruttura?: string;
  aslId?: number;
  imported: boolean;
  note?: string | null;
}

@Component({
  selector: 'app-hospital-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="card dashboard-content-card asl-management-shell hospital-management-shell">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('dashboard.menu.hospital') }}</h2>
          <p>{{ t('hospital.management.subtitle') }}</p>
        </div>
        <div class="asl-header-actions hospital-header-actions">
          <a class="btn btn-primary asl-filter-toggle hospital-upload-link" routerLink="/dashboard/hospitals/import">
            {{ t('hospital.management.uploadAction') }}
          </a>
          <button class="btn btn-outline asl-filter-toggle" type="button" (click)="showFilters = !showFilters">
            <span class="asl-filter-toggle-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M5 9H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M7 13H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            {{ t('asl.actions.filters') }}
          </button>
        </div>
      </div>

      <p class="dashboard-selection-info hospital-management-info">{{ t('hospital.management.detail') }}</p>

      <section *ngIf="showFilters" class="search-filters-panel asl-filters-panel">
        <div class="asl-filters-grid hospital-filters-grid">
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.id') }}</span>
            <input class="asl-filter-input" type="number" [(ngModel)]="filters.id" />
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.regionCode') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.regionCode">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let region of regionOptions" [value]="region.code">{{ region.label }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.aslCode') }}</span>
            <input class="asl-filter-input" type="text" [(ngModel)]="filters.aslCode" />
          </label>
          <label class="asl-filter-field asl-filter-field-wide">
            <span class="asl-filter-label">{{ t('hospital.filter.name') }}</span>
            <input class="asl-filter-input" type="text" [(ngModel)]="filters.name" />
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.code') }}</span>
            <input class="asl-filter-input" type="text" [(ngModel)]="filters.code" />
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.type') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.type">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let type of typeOptions" [value]="type">{{ type }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('hospital.filter.imported') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.imported">
              <option value="all">{{ t('hospital.filter.status.all') }}</option>
              <option value="imported">{{ t('hospital.filter.status.imported') }}</option>
              <option value="notImported">{{ t('hospital.filter.status.notImported') }}</option>
            </select>
          </label>
          <div class="asl-filter-actions">
            <button class="btn btn-primary" type="button" (click)="search()">{{ t('crud.actions.search') }}</button>
            <button class="btn btn-outline" type="button" (click)="resetFilters()">{{ t('crud.actions.reset') }}</button>
          </div>
        </div>
      </section>

      <div *ngIf="message" class="alert" [class.alert-success]="messageType === 'success'" [class.alert-danger]="messageType === 'error'">
        {{ message }}
      </div>

      <section class="modern-table asl-table-panel">
        <div class="asl-table-toolbar">
          <div class="asl-table-count">{{ filteredRecords().length }} {{ t('crud.items') }}</div>
          <button *ngIf="!showTableSearch" class="asl-table-search-trigger" type="button" (click)="showTableSearch = true" [attr.aria-label]="t('search.table.open')" [title]="t('search.table.open')">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="6.25" stroke="currentColor" stroke-width="1.8"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
          <div *ngIf="showTableSearch" class="table-search-input-wrapper asl-table-search-box">
            <span class="search-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="6.25" stroke="currentColor" stroke-width="1.8"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            <input
              type="text"
              [(ngModel)]="tableSearchText"
              [ngModelOptions]="{ standalone: true }"
              [placeholder]="t('search.table.placeholder')"
              class="table-search-input"
            />
            <button class="close-btn" type="button" (click)="closeTableSearch()" [title]="t('search.table.close')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4L12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="table-responsive asl-table-wrapper">
          <table class="search-table asl-search-table hospital-search-table">
          <thead>
            <tr>
              <th>{{ t('hospital.column.id') }}</th>
              <th>{{ t('hospital.column.year') }}</th>
              <th>{{ t('hospital.column.region') }}</th>
              <th>{{ t('hospital.column.asl') }}</th>
              <th>{{ t('hospital.column.code') }}</th>
              <th>{{ t('hospital.column.name') }}</th>
              <th>{{ t('hospital.column.municipality') }}</th>
              <th>{{ t('hospital.column.type') }}</th>
              <th class="asl-actions-column">{{ t('search.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let hospital of paginatedRecords(); trackBy: trackById">
              <td class="hospital-cell-id">{{ hospital.id }}</td>
              <td class="hospital-cell-year">{{ hospital.anno ?? '-' }}</td>
              <td class="hospital-cell-region">{{ formatRegion(hospital) }}</td>
              <td class="hospital-cell-asl">{{ formatAsl(hospital) }}</td>
              <td>{{ hospital.codiceStruttura || '-' }}</td>
              <td class="hospital-cell-name">{{ hospital.struttura || '-' }}</td>
              <td>{{ formatMunicipality(hospital) }}</td>
              <td>{{ hospital.tipoStruttura || '-' }}</td>
              <td class="asl-actions-cell">
                <button class="btn btn-primary btn-sm" type="button" (click)="importRow(hospital)" *ngIf="!hospital.imported">
                  {{ t('hospital.action.importRow') }}
                </button>
                <button class="btn btn-secondary btn-sm" type="button" (click)="disassociateRow(hospital)" *ngIf="hospital.imported">
                  {{ t('hospital.action.disassociateRow') }}
                </button>
              </td>
            </tr>
            <tr *ngIf="paginatedRecords().length === 0">
              <td class="asl-empty-cell" colspan="8">{{ t('search.noResults') }}</td>
            </tr>
          </tbody>
          </table>
        </div>

        <div class="asl-table-footer" *ngIf="filteredRecords().length > 0">
          <div class="search-pagination asl-pagination">
            <span class="asl-pagination-text">{{ t('asl.pagination.page') }} {{ currentPage }} {{ t('asl.pagination.of') }} {{ totalPages }}</span>
            <div class="asl-pagination-buttons">
              <button class="btn btn-outline asl-pagination-button" type="button" (click)="goToPage(currentPage - 1)" [disabled]="currentPage <= 1" [attr.aria-label]="t('asl.pagination.previous')">&lt;</button>
              <button class="btn btn-outline asl-pagination-button" type="button" (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages" [attr.aria-label]="t('asl.pagination.next')">&gt;</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class HospitalManagementComponent implements OnInit {
  filters = {
    id: '' as string,
    regionCode: '' as string,
    aslCode: '' as string,
    code: '' as string,
    name: '' as string,
    type: '' as string,
    imported: 'all' as 'all' | 'imported' | 'notImported'
  };
  allHospitalRecords: HospitalRecord[] = [];
  pageSize = 10;
  currentPage = 1;
  showFilters = true;
  showTableSearch = false;
  tableSearchText = '';
  regionOptions: Array<{ code: string; label: string }> = [];
  typeOptions: string[] = [];
  translations: Record<string, string> = {};
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(
    private readonly http: HttpClient,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  ngOnInit(): void {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe((translations: Record<string, string>) => {
      this.translations = translations;
      this.loadOverview();
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  loadOverview(): void {
    this.http.get<HospitalRecord[]>(`${environment.apiBaseUrl}/hospital/overview`).subscribe({
      next: (records: HospitalRecord[]) => {
        this.allHospitalRecords = records;
        this.regionOptions = this.buildRegionOptions(records);
        this.typeOptions = this.buildTypeOptions(records);
        this.currentPage = 1;
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'hospital.messages.loadError');
      }
    });
  }

  filteredRecords(): HospitalRecord[] {
    return this.allHospitalRecords.filter((hospital) => {
      if (this.filters.id && hospital.id !== Number(this.filters.id)) {
        return false;
      }
      if (this.filters.regionCode && (hospital.codiceRegione || '') !== this.filters.regionCode) {
        return false;
      }
      if (this.filters.aslCode && !(hospital.codiceAsl || '').toLowerCase().includes(this.filters.aslCode.toLowerCase())) {
        return false;
      }
      if (this.filters.code && !(hospital.codiceStruttura || '').toLowerCase().includes(this.filters.code.toLowerCase())) {
        return false;
      }
      if (this.filters.name && !(hospital.struttura || '').toLowerCase().includes(this.filters.name.toLowerCase())) {
        return false;
      }
      if (this.filters.type && (hospital.tipoStruttura || '') !== this.filters.type) {
        return false;
      }
      if (this.filters.imported === 'imported' && !hospital.imported) {
        return false;
      }
      if (this.filters.imported === 'notImported' && hospital.imported) {
        return false;
      }
      return true;
    });
  }

  search(): void {
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.filters = { id: '', regionCode: '', aslCode: '', code: '', name: '', type: '', imported: 'all' };
    this.currentPage = 1;
  }

  paginatedRecords(): HospitalRecord[] {
    const list = this.tableFilteredRecords();
    const start = (this.currentPage - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.tableFilteredRecords().length / this.pageSize));
  }

  closeTableSearch(): void {
    this.tableSearchText = '';
    this.showTableSearch = false;
    this.currentPage = 1;
  }

  formatRegion(hospital: HospitalRecord): string {
    if (hospital.regione && hospital.codiceRegione) {
      return `${hospital.regione} (${hospital.codiceRegione})`;
    }
    if (hospital.regione) {
      return hospital.regione;
    }
    if (hospital.codiceRegione) {
      return hospital.codiceRegione;
    }
    return '-';
  }

  formatAsl(hospital: HospitalRecord): string {
    if (hospital.asl && hospital.codiceAsl) {
      return `${hospital.asl} (${hospital.codiceAsl})`;
    }
    if (hospital.asl) {
      return hospital.asl;
    }
    if (hospital.codiceAsl) {
      return hospital.codiceAsl;
    }
    return '-';
  }

  formatMunicipality(hospital: HospitalRecord): string {
    if (hospital.comune && hospital.siglaProvincia) {
      return `${hospital.comune} (${hospital.siglaProvincia})`;
    }
    return hospital.comune || hospital.siglaProvincia || '-';
  }

  goToPage(page: number): void {
    if (page < 1) {
      this.currentPage = 1;
      return;
    }
    if (page > this.totalPages) {
      this.currentPage = this.totalPages;
      return;
    }
    this.currentPage = page;
  }

  trackById(_: number, hospital: HospitalRecord): number {
    return hospital.id;
  }

  importRow(hospital: HospitalRecord): void {
    const dashboardBase = (environment as any).dashboardApiBaseUrl || environment.apiBaseUrl;
    this.http.post<HospitalRecord[]>(`${dashboardBase}/hospital/import`, { sourceIds: [hospital.id] }).subscribe({
      next: () => {
        this.showMessage('hospital.messages.associateSuccess', 'success');
        this.loadOverview();
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'hospital.messages.associateError');
      }
    });
  }

  disassociateRow(hospital: HospitalRecord): void {
    const dashboardBase = (environment as any).dashboardApiBaseUrl || environment.apiBaseUrl;
    this.http.delete<void>(`${dashboardBase}/hospital/${hospital.id}`).subscribe({
      next: () => {
        this.showMessage('hospital.messages.disassociateSuccess', 'success');
        this.loadOverview();
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'hospital.messages.disassociateError');
      }
    });
  }

  private showMessage(messageKey: string, type: 'success' | 'error'): void {
    this.message = this.t(messageKey);
    this.messageType = type;
    window.setTimeout(() => {
      this.message = '';
    }, 4000);
  }

  private showErrorMessage(error: { error?: ProblemDetailPayload } | undefined, fallbackKey: string): void {
    const detail = error?.error?.detail?.trim() || error?.error?.message?.trim();
    this.message = detail || this.t(fallbackKey);
    this.messageType = 'error';
    window.setTimeout(() => {
      this.message = '';
    }, 6000);
  }

  private tableFilteredRecords(): HospitalRecord[] {
    const normalizedSearch = this.tableSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return this.filteredRecords();
    }

    return this.filteredRecords().filter((hospital) => {
      const haystack = [
        String(hospital.id),
        String(hospital.anno ?? ''),
        hospital.codiceRegione ?? '',
        hospital.regione ?? '',
        hospital.codiceAsl ?? '',
        hospital.asl ?? '',
        hospital.codiceStruttura ?? '',
        hospital.struttura ?? '',
        hospital.comune ?? '',
        hospital.siglaProvincia ?? '',
        hospital.tipoStruttura ?? ''
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }

  private buildRegionOptions(records: HospitalRecord[]): Array<{ code: string; label: string }> {
    return records
      .filter((record) => !!record.codiceRegione)
      .map((record) => ({
        code: record.codiceRegione as string,
        label: record.regione ? `${record.regione} (${record.codiceRegione})` : (record.codiceRegione as string)
      }))
      .filter((record, index, array) => array.findIndex((candidate) => candidate.code === record.code) === index)
      .sort((left, right) => left.label.localeCompare(right.label, 'it', { sensitivity: 'base' }));
  }

  private buildTypeOptions(records: HospitalRecord[]): string[] {
    return records
      .map((record) => record.tipoStruttura || '')
      .filter((type) => !!type)
      .filter((type, index, array) => array.indexOf(type) === index)
      .sort((left, right) => left.localeCompare(right, 'it', { sensitivity: 'base' }));
  }
}
