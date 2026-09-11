import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
// FIXME Francesco: mantenere gli endpoint ASL agganciati alla configurazione frontend, senza URL assoluti cablati.
import { environment } from '../../../environments/environment';

interface ProblemDetailPayload {
  detail?: string;
  message?: string;
}

interface AslRecord {
  id: number;
  codiceAzienda: string;
  denominazioneAzienda: string;
  provinciaId?: number;
  indirizzo?: string;
  telefono?: string;
  email?: string;
  imported: boolean;
  note?: string | null;
  codiceRegione?: string;
  anno?: number;
  provinciaDescrizione?: string;
  regioneDescrizione?: string;
}

@Component({
  selector: 'app-asl-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card dashboard-content-card asl-management-shell">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('dashboard.menu.asl') }}</h2>
          <p>{{ t('asl.management.subtitle') }}</p>
        </div>
        <div class="asl-header-actions">
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

      <section *ngIf="showFilters" class="search-filters-panel asl-filters-panel">
        <div class="asl-filters-grid">
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('asl.filter.id') }}</span>
            <input class="asl-filter-input" type="number" [(ngModel)]="filters.id" />
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('asl.filter.code') }}</span>
            <input class="asl-filter-input" type="text" [(ngModel)]="filters.code" />
          </label>
          <label class="asl-filter-field asl-filter-field-wide">
            <span class="asl-filter-label">{{ t('asl.filter.name') }}</span>
            <input class="asl-filter-input" type="text" [(ngModel)]="filters.name" />
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('patients.field.region') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.regionId" (ngModelChange)="onRegionChange($event)">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let r of regions" [value]="r.id">{{ r.name }}{{ r.regionCode ? ' (' + padRegionCode(r.regionCode) + ')' : '' }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('patients.field.province') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.provinceId">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let p of provinces" [value]="p.id">{{ p.name }}</option>
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
          <div class="asl-table-toolbar-spacer"></div>
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
          <table class="search-table asl-search-table">
            <thead>
              <tr>
                <th>{{ t('asl.column.id') }}</th>
                <th>{{ t('asl.column.code') }}</th>
                <th>{{ t('asl.column.name') }}</th>
                <th>{{ t('asl.column.regionDescription') }}</th>
                <th>{{ t('asl.column.provinceDescription') }}</th>
                <th>{{ t('asl.column.year') }}</th>
                <th>{{ t('asl.column.address') }}</th>
                <th>{{ t('asl.column.email') }}</th>
                <th>{{ t('asl.column.phone') }}</th>
                <th class="asl-actions-column">{{ t('search.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let asl of paginatedRecords(); trackBy: trackById">
                <td class="asl-cell-id">{{ asl.id }}</td>
                <td>{{ asl.codiceAzienda }}</td>
                <td class="asl-cell-name">{{ asl.denominazioneAzienda }}</td>
                <td>{{ formatRegion(asl) }}</td>
                <td>{{ asl.provinciaDescrizione || '-' }}</td>
                <td class="asl-cell-year">{{ asl.anno ?? '-' }}</td>
                <td class="asl-cell-address">{{ asl.indirizzo || '-' }}</td>
                <td class="asl-cell-email">{{ asl.email || '-' }}</td>
                <td class="asl-cell-phone">{{ asl.telefono || '-' }}</td>
                <td class="asl-actions-cell">
                  <button class="btn btn-primary btn-sm" type="button" (click)="importRow(asl)" *ngIf="!asl.imported">
                    {{ t('asl.action.importRow') }}
                  </button>
                  <button class="btn btn-secondary btn-sm" type="button" (click)="disassociateRow(asl)" *ngIf="asl.imported">
                    {{ t('asl.action.disassociateRow') }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="paginatedRecords().length === 0">
                <td class="asl-empty-cell" colspan="10">{{ t('search.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="asl-table-footer" *ngIf="filteredRecords().length > 0">
          <div class="asl-table-count">{{ filteredRecords().length }} {{ t('crud.items') }}</div>
          <div class="search-pagination asl-pagination">
            <span class="asl-pagination-text">{{ t('asl.pagination.page') }} {{ currentPage }} {{ t('asl.pagination.of') }} {{ totalPages }}</span>
            <div class="asl-pagination-buttons">
              <button class="btn btn-outline asl-pagination-button" type="button" (click)="goToPage(currentPage-1)" [disabled]="currentPage<=1" [attr.aria-label]="t('asl.pagination.previous')">&lt;</button>
              <button class="btn btn-outline asl-pagination-button" type="button" (click)="goToPage(currentPage+1)" [disabled]="currentPage>=totalPages" [attr.aria-label]="t('asl.pagination.next')">&gt;</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class AslManagementComponent implements OnInit {
  filters = {
    id: '' as string,
    code: '' as string,
    name: '' as string,
    imported: 'all' as 'all' | 'imported' | 'notImported',
    regionId: '' as string,
    regionCode: '' as string,
    provinceId: '' as string
  };
  allAslRecords: AslRecord[] = [];
  // regions come dall'API con shape { id, regionCode, name, ... }
  regions: Array<{ id: number; name: string; regionCode?: string }> = [];
  provinces: Array<{ id: number; name: string }> = [];
  pageSize = 10;
  currentPage = 1;
  showFilters = true;
  showTableSearch = false;
  tableSearchText = '';
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
      this.loadRegions();
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  loadOverview(): void {
    // FIXME Francesco: usare sempre environment.apiBaseUrl per le API frontend; non introdurre percorsi assoluti /api.
    this.http.get<AslRecord[]>(`${environment.apiBaseUrl}/asl/overview`).subscribe({
      next: (records: AslRecord[]) => {
        this.allAslRecords = records;
        // reset paging when new data arrives
        this.currentPage = 1;
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'asl.messages.loadError');
      }
    });
  }

  filteredRecords(): AslRecord[] {
    return this.allAslRecords.filter((asl) => {
      if (this.filters.id && asl.id !== Number(this.filters.id)) {
        return false;
      }
      if (this.filters.code && !asl.codiceAzienda.toLowerCase().includes(this.filters.code.toLowerCase())) {
        return false;
      }
      if (this.filters.name && !asl.denominazioneAzienda.toLowerCase().includes(this.filters.name.toLowerCase())) {
        return false;
      }
      if (this.filters.imported === 'imported' && !asl.imported) {
        return false;
      }
      if (this.filters.imported === 'notImported' && asl.imported) {
        return false;
      }
      if (this.filters.regionCode) {
        const code = this.padRegionCode(String(asl.codiceRegione ?? ''));
        if (code !== String(this.filters.regionCode)) {
          return false;
        }
      }
      if (this.filters.provinceId && String(asl.provinciaId ?? '') !== String(this.filters.provinceId)) {
        return false;
      }
      return true;
    });
  }

  private getRegionNameById(regionId: string): string | undefined {
    const r = this.regions.find((x) => String(x.id) === String(regionId));
    return r?.name;
  }

  padRegionCode(codeOrId: string | number): string {
    const s = String(codeOrId ?? '').trim();
    if (s.length === 0) return s;
    return s.padStart(2, '0');
  }

  formatRegion(asl: AslRecord): string {
    const rawCode = String(asl.codiceRegione ?? '').trim();
    const code = rawCode ? this.padRegionCode(rawCode) : '';
    const descFromRecord = asl.regioneDescrizione?.trim();
    if (descFromRecord && code) return `${descFromRecord} (${code})`;
    // try to decode region name from loaded regions list by matching regionCode
    if (rawCode) {
      const r = this.regions.find((x) => String(x.regionCode) === rawCode || String(this.padRegionCode(x.regionCode ?? '')) === code);
      if (r) return `${r.name} (${this.padRegionCode(r.regionCode ?? r.id)})`;
    }
    if (descFromRecord) return descFromRecord;
    if (code) return `(${code})`;
    return '-';
  }

  paginatedRecords(): AslRecord[] {
    const list = this.tableFilteredRecords();
    const start = (this.currentPage - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.tableFilteredRecords().length / this.pageSize));
  }

  search(): void {
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.filters = { id: '', code: '', name: '', imported: 'all', regionId: '', regionCode: '', provinceId: '' };
    this.provinces = [];
    this.currentPage = 1;
  }

  closeTableSearch(): void {
    this.tableSearchText = '';
    this.showTableSearch = false;
    this.currentPage = 1;
  }

  importRow(asl: AslRecord): void {
    // FIXME Francesco: usare sempre environment.apiBaseUrl; /api assoluto non rispetta il base path di deploy.
    this.http.post<AslRecord[]>(`${environment.apiBaseUrl}/asl/import`, { sourceIds: [asl.id] }).subscribe({
      next: () => {
        this.showMessage('asl.messages.associateSuccess', 'success');
        this.loadOverview();
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'asl.messages.associateError');
      }
    });
  }

  disassociateRow(asl: AslRecord): void {
    // FIXME Francesco: usare sempre environment.apiBaseUrl; /api assoluto non rispetta il base path di deploy.
    this.http.delete<void>(`${environment.apiBaseUrl}/asl/${asl.id}`).subscribe({
      next: () => {
        this.showMessage('asl.messages.disassociateSuccess', 'success');
        this.loadOverview();
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'asl.messages.disassociateError');
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

  // region/province helpers
  private loadRegions(): void {
    this.http.get<Array<{ id: number; name: string; regionCode?: string }>>(`${environment.apiBaseUrl}/regions`).subscribe({
      next: (regions) => (this.regions = regions),
      error: () => {
        // ignore silently for filters
      }
    });
  }

  private loadProvinces(regionId: number): void {
    this.http.get<Array<{ id: number; name: string }>>(`${environment.apiBaseUrl}/provinces/by-region/${regionId}`).subscribe({
      next: (provinces) => (this.provinces = provinces),
      error: () => {
        // ignore silently
      }
    });
  }

  onRegionChange(regionId: string): void {
    this.filters.provinceId = '';
    this.provinces = [];
    this.currentPage = 1;
    // set regionCode for filtering using region.regionCode returned by API
    const sel = this.regions.find((r) => String(r.id) === String(regionId));
    this.filters.regionCode = sel?.regionCode ? this.padRegionCode(sel.regionCode) : '';
    if (regionId) {
      this.loadProvinces(Number(regionId));
    }
  }

  // pagination actions
  goToPage(n: number): void {
    if (n < 1) n = 1;
    if (n > this.totalPages) n = this.totalPages;
    this.currentPage = n;
  }

  trackById(_: number, asl: AslRecord): number {
    return asl.id;
  }

  private tableFilteredRecords(): AslRecord[] {
    const normalizedSearch = this.tableSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return this.filteredRecords();
    }

    return this.filteredRecords().filter((asl) => {
      const haystack = [
        String(asl.id),
        asl.codiceAzienda,
        asl.denominazioneAzienda,
        this.formatRegion(asl),
        asl.provinciaDescrizione ?? '',
        String(asl.anno ?? ''),
        asl.indirizzo ?? '',
        asl.email ?? '',
        asl.telefono ?? ''
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }
}
