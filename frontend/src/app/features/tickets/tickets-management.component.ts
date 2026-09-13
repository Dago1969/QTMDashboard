import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { QtmStepModalComponent } from '../../shared/qtm-step-modal.component';

interface ProblemDetailPayload {
  detail?: string;
  message?: string;
}

interface TicketRecord {
  id: number;
  realm?: string;
  project?: string;
  patientId?: string;
  therapeuticPlanId?: string;
  ticketType?: string;
  status?: string;
  title?: string;
  description?: string;
  contentJson?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TicketPageResponse {
  content?: TicketRecord[];
  totalPages?: number;
  totalElements?: number;
  size?: number;
  number?: number;
}

interface TicketFilterOptions {
  realms?: string[];
  projects?: string[];
  patientIds?: string[];
  statuses?: string[];
}

/**
 * Elenco ticket letto da QTMTicket con filtri principali server-side e ricerca rapida locale nella pagina corrente.
 */
@Component({
  selector: 'app-tickets-management',
  standalone: true,
  imports: [CommonModule, FormsModule, QtmStepModalComponent],
  template: `
    <div class="card dashboard-content-card asl-management-shell hospital-management-shell">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('dashboard.menu.tickets') }}</h2>
          <p>{{ t('tickets.management.subtitle') }}</p>
        </div>
        <div class="asl-header-actions hospital-header-actions">
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

      <p class="dashboard-selection-info hospital-management-info">{{ t('tickets.management.detail') }}</p>

      <section *ngIf="showFilters" class="search-filters-panel asl-filters-panel">
        <div class="asl-filters-grid hospital-filters-grid">
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('tickets.filter.realm') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.realm" (ngModelChange)="onFiltersChanged('realm')">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let option of realmOptions" [value]="option">{{ option }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('tickets.filter.project') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.project" (ngModelChange)="onFiltersChanged('project')">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let option of projectOptions" [value]="option">{{ option }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('tickets.filter.patientId') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.patientId" (ngModelChange)="onFiltersChanged('patientId')">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let option of patientOptions" [value]="option">{{ option }}</option>
            </select>
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('tickets.filter.status') }}</span>
            <select class="asl-filter-input" [(ngModel)]="filters.status" (ngModelChange)="onFiltersChanged('status')">
              <option value="">{{ t('crud.select.all') }}</option>
              <option *ngFor="let option of statusOptions" [value]="option">{{ option }}</option>
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
          <div class="asl-table-count">{{ totalElements }} {{ t('crud.items') }}</div>
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
                <th>{{ t('tickets.column.id') }}</th>
                <th>{{ t('tickets.column.createdAt') }}</th>
                <th>{{ t('tickets.column.realm') }}</th>
                <th>{{ t('tickets.column.project') }}</th>
                <th>{{ t('tickets.column.patientId') }}</th>
                <th>{{ t('tickets.column.therapeuticPlanId') }}</th>
                <th>{{ t('tickets.column.ticketType') }}</th>
                <th>{{ t('tickets.column.status') }}</th>
                <th>{{ t('tickets.column.title') }}</th>
                <th>{{ t('search.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let ticket of tableFilteredRecords(); trackBy: trackById">
                <td>{{ ticket.id }}</td>
                <td>{{ formatDateTime(ticket.createdAt) }}</td>
                <td>{{ ticket.realm || '-' }}</td>
                <td>{{ ticket.project || '-' }}</td>
                <td>{{ ticket.patientId || '-' }}</td>
                <td>{{ ticket.therapeuticPlanId || '-' }}</td>
                <td>{{ ticket.ticketType || '-' }}</td>
                <td>{{ ticket.status || '-' }}</td>
                <td>{{ ticket.title || '-' }}</td>
                <td class="actions">
                  <button class="icon-btn" type="button" (click)="openDetails(ticket)" [title]="t('search.action.view')">
                    <span class="icon">👁️</span>
                  </button>
                  <button class="icon-btn" type="button" (click)="closeTicket(ticket)" [title]="t('tickets.action.close')" [disabled]="!canClose(ticket) || closingTicketId === ticket.id">
                    <span class="icon">✅</span>
                  </button>
                </td>
              </tr>
              <tr *ngIf="tableFilteredRecords().length === 0">
                <td class="asl-empty-cell" colspan="10">{{ t('tickets.search.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="asl-table-footer" *ngIf="totalElements > 0">
          <div class="search-pagination asl-pagination">
            <span class="asl-pagination-text">{{ t('asl.pagination.page') }} {{ currentPage + 1 }} {{ t('asl.pagination.of') }} {{ totalPages }}</span>
            <div class="asl-pagination-buttons">
              <button class="btn btn-outline asl-pagination-button" type="button" (click)="loadPage(currentPage - 1)" [disabled]="currentPage <= 0" [attr.aria-label]="t('asl.pagination.previous')">&lt;</button>
              <button class="btn btn-outline asl-pagination-button" type="button" (click)="loadPage(currentPage + 1)" [disabled]="currentPage + 1 >= totalPages" [attr.aria-label]="t('asl.pagination.next')">&gt;</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <qtm-step-modal
      *ngIf="selectedTicket"
      [title]="t('tickets.details.title')"
      [step]="1"
      [totalSteps]="1"
      [stepTitle]="selectedTicket.title || t('tickets.details.title')"
      [stepDescription]="t('tickets.details.subtitle')"
      (close)="closeDetails()"
    >
      <div class="tickets-details-grid">
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.id') }}</strong>
          <span>{{ selectedTicket.id }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.status') }}</strong>
          <span>{{ selectedTicket.status || '-' }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.realm') }}</strong>
          <span>{{ selectedTicket.realm || '-' }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.project') }}</strong>
          <span>{{ selectedTicket.project || '-' }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.patientId') }}</strong>
          <span>{{ selectedTicket.patientId || '-' }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.therapeuticPlanId') }}</strong>
          <span>{{ selectedTicket.therapeuticPlanId || '-' }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.ticketType') }}</strong>
          <span>{{ selectedTicket.ticketType || '-' }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.createdAt') }}</strong>
          <span>{{ formatDateTime(selectedTicket.createdAt) }}</span>
        </div>
        <div class="tickets-detail-card">
          <strong>{{ t('tickets.column.updatedAt') }}</strong>
          <span>{{ formatDateTime(selectedTicket.updatedAt) }}</span>
        </div>
        <div class="tickets-detail-card tickets-detail-card-wide">
          <strong>{{ t('tickets.column.title') }}</strong>
          <span>{{ selectedTicket.title || '-' }}</span>
        </div>
        <div class="tickets-detail-card tickets-detail-card-wide">
          <strong>{{ t('tickets.details.description') }}</strong>
          <span>{{ selectedTicket.description || '-' }}</span>
        </div>
        <div class="tickets-detail-card tickets-detail-card-wide">
          <strong>{{ t('tickets.details.contentJson') }}</strong>
          <pre>{{ selectedTicket.contentJson || '-' }}</pre>
        </div>
      </div>

      <div modal-actions>
        <button type="button" class="btn btn-outline" (click)="closeDetails()">{{ t('common.ok') }}</button>
        <button type="button" class="btn btn-primary" (click)="closeTicket(selectedTicket)" [disabled]="!canClose(selectedTicket) || closingTicketId === selectedTicket.id">
          {{ t('tickets.action.close') }}
        </button>
      </div>
    </qtm-step-modal>
  `
})
export class TicketsManagementComponent implements OnInit {
  filters = {
    realm: '',
    project: '',
    patientId: '',
    status: ''
  };
  tickets: TicketRecord[] = [];
  translations: Record<string, string> = {};
  showFilters = true;
  showTableSearch = false;
  tableSearchText = '';
  currentPage = 0;
  totalPages = 1;
  totalElements = 0;
  pageSize = 20;
  realmOptions: string[] = [];
  projectOptions: string[] = [];
  patientOptions: string[] = [];
  statusOptions: string[] = [];
  selectedTicket: TicketRecord | null = null;
  closingTicketId: number | null = null;
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(
    private readonly http: HttpClient,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  ngOnInit(): void {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe((translations: Record<string, string>) => {
      this.translations = translations;
      this.loadFilterOptions(true);
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  search(): void {
    this.loadPage(0);
  }

  resetFilters(): void {
    this.filters = {
      realm: '',
      project: '',
      patientId: '',
      status: ''
    };
    this.loadFilterOptions(true);
  }

  onFiltersChanged(changedField: 'realm' | 'project' | 'patientId' | 'status'): void {
    if (changedField === 'realm') {
      this.filters.project = '';
      this.filters.patientId = '';
      this.filters.status = '';
    }

    if (changedField === 'project') {
      this.filters.patientId = '';
      this.filters.status = '';
    }

    if (changedField === 'patientId') {
      this.filters.status = '';
    }

    this.loadFilterOptions(false);
  }

  loadPage(page: number): void {
    const normalizedPage = Math.max(0, page);
    let params = new HttpParams()
      .set('page', String(normalizedPage))
      .set('size', String(this.pageSize))
      .set('sort', 'createdAt,desc');

    if (this.filters.realm.trim()) {
      params = params.set('realm', this.filters.realm.trim());
    }
    if (this.filters.project.trim()) {
      params = params.set('project', this.filters.project.trim());
    }
    if (this.filters.patientId.trim()) {
      params = params.set('patientId', this.filters.patientId.trim());
    }
    if (this.filters.status.trim()) {
      params = params.set('status', this.filters.status.trim());
    }

    this.http.get<TicketPageResponse>(`${environment.ticketApiBaseUrl}/tickets/search`, { params }).subscribe({
      next: (response) => {
        this.tickets = response.content ?? [];
        this.currentPage = response.number ?? normalizedPage;
        this.totalPages = Math.max(1, response.totalPages ?? 1);
        this.totalElements = response.totalElements ?? this.tickets.length;
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.tickets = [];
        this.currentPage = 0;
        this.totalPages = 1;
        this.totalElements = 0;
        this.showErrorMessage(error, 'tickets.messages.loadError');
      }
    });
  }

  closeTableSearch(): void {
    this.tableSearchText = '';
    this.showTableSearch = false;
  }

  tableFilteredRecords(): TicketRecord[] {
    const normalizedSearch = this.tableSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return this.tickets;
    }

    return this.tickets.filter((ticket) => {
      const haystack = [
        String(ticket.id),
        ticket.realm ?? '',
        ticket.project ?? '',
        ticket.patientId ?? '',
        ticket.therapeuticPlanId ?? '',
        ticket.ticketType ?? '',
        ticket.status ?? '',
        ticket.title ?? '',
        ticket.description ?? ''
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString('it-IT');
  }

  trackById(_: number, ticket: TicketRecord): number {
    return ticket.id;
  }

  canClose(ticket: TicketRecord): boolean {
    return (ticket.status ?? '').toUpperCase() !== 'CLOSED';
  }

  openDetails(ticket: TicketRecord): void {
    this.http.get<TicketRecord>(`${environment.ticketApiBaseUrl}/tickets/${ticket.id}`).subscribe({
      next: (loadedTicket) => {
        this.selectedTicket = loadedTicket;
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(error, 'tickets.messages.loadError');
      }
    });
  }

  closeDetails(): void {
    this.selectedTicket = null;
  }

  closeTicket(ticket: TicketRecord): void {
    if (!this.canClose(ticket) || this.closingTicketId === ticket.id) {
      return;
    }

    this.closingTicketId = ticket.id;
    this.http.patch<TicketRecord>(`${environment.ticketApiBaseUrl}/tickets/${ticket.id}/status/CLOSED`, {}).subscribe({
      next: (updatedTicket) => {
        this.closingTicketId = null;
        this.message = this.t('tickets.messages.closeSuccess');
        this.messageType = 'success';
        this.tickets = this.tickets.map((currentTicket) => currentTicket.id === updatedTicket.id ? updatedTicket : currentTicket);
        if (this.selectedTicket?.id === updatedTicket.id) {
          this.selectedTicket = updatedTicket;
        }
        this.loadFilterOptions(true);
        window.setTimeout(() => {
          this.message = '';
        }, 4000);
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.closingTicketId = null;
        this.showErrorMessage(error, 'tickets.messages.closeError');
      }
    });
  }

  private loadFilterOptions(loadTicketsAfter: boolean): void {
    let params = new HttpParams();

    if (this.filters.realm.trim()) {
      params = params.set('realm', this.filters.realm.trim());
    }
    if (this.filters.project.trim()) {
      params = params.set('project', this.filters.project.trim());
    }
    if (this.filters.patientId.trim()) {
      params = params.set('patientId', this.filters.patientId.trim());
    }
    if (this.filters.status.trim()) {
      params = params.set('status', this.filters.status.trim());
    }

    this.http.get<TicketFilterOptions>(`${environment.ticketApiBaseUrl}/tickets/filter-options`, { params }).subscribe({
      next: (response) => {
        this.realmOptions = response.realms ?? [];
        this.projectOptions = response.projects ?? [];
        this.patientOptions = response.patientIds ?? [];
        this.statusOptions = response.statuses ?? [];
        this.normalizeSelectedFilters();
        if (loadTicketsAfter) {
          this.loadPage(0);
        }
      },
      error: (error: { error?: ProblemDetailPayload }) => {
        this.realmOptions = [];
        this.projectOptions = [];
        this.patientOptions = [];
        this.statusOptions = [];
        this.showErrorMessage(error, 'tickets.messages.loadError');
      }
    });
  }

  private normalizeSelectedFilters(): void {
    if (this.filters.realm && !this.realmOptions.includes(this.filters.realm)) {
      this.filters.realm = '';
    }
    if (this.filters.project && !this.projectOptions.includes(this.filters.project)) {
      this.filters.project = '';
    }
    if (this.filters.patientId && !this.patientOptions.includes(this.filters.patientId)) {
      this.filters.patientId = '';
    }
    if (this.filters.status && !this.statusOptions.includes(this.filters.status)) {
      this.filters.status = '';
    }
  }

  private showErrorMessage(error: { error?: ProblemDetailPayload } | undefined, fallbackKey: string): void {
    const detail = error?.error?.detail?.trim() || error?.error?.message?.trim();
    this.message = detail || this.t(fallbackKey);
    this.messageType = 'error';
    window.setTimeout(() => {
      this.message = '';
    }, 6000);
  }
}