import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, AfterViewInit, TemplateRef, ViewChild } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { SortableTableComponent, SortColumn } from '../../shared/components/sortable-table/sortable-table.component';
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
  // parsed fields from contentJson
  contentParsed?: any;
  patientCode?: string;
  patientName?: string;
  patientDisplay?: string;
  visitDate?: string;
  visitDateFormatted?: string;
  prevalentNurseName?: string;
  hospitalDepartment?: string;
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
  nurseIds?: string[];
  statuses?: string[];
}

/**
 * Elenco ticket letto da QTMTicket con filtri principali server-side e ricerca rapida locale nella pagina corrente.
 */
@Component({
  selector: 'app-tickets-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, QtmStepModalComponent, SortableTableComponent],
  styleUrls: ['./tickets-management.component.css'],
  template: `
    <div class="page-container">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="page-title">{{ t('tickets.search.title') || 'Ricerca Ticket' }}</h1>
      </div>

      <div class="card card-custom p-4 mb-4">
        <form [formGroup]="filterForm" (ngSubmit)="onSearch()">
          <div class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label text-uppercase fs-7 fw-bold">{{ t('tickets.filter.realm') }}</label>
              <select formControlName="realm" class="form-select custom-input">
                <option value="">{{ t('crud.select.all') }}</option>
                <option *ngFor="let r of realmOptions" [value]="r">{{ r }}</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label text-uppercase fs-7 fw-bold">{{ t('tickets.filter.project') }}</label>
              <select formControlName="project" class="form-select custom-input">
                <option value="">{{ t('crud.select.all') }}</option>
                <option *ngFor="let p of projectOptions" [value]="p">{{ p }}</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label text-uppercase fs-7 fw-bold">{{ t('tickets.filter.patient') || 'Paziente' }}</label>
              <select formControlName="patientId" class="form-select custom-input">
                <option value="">{{ t('crud.select.all') }}</option>
                <option *ngFor="let p of patientOptions" [value]="p">{{ p }}</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label text-uppercase fs-7 fw-bold">{{ t('tickets.filter.nurse') || 'Infermiere' }}</label>
              <select formControlName="nurseId" class="form-select custom-input">
                <option value="">{{ t('crud.select.all') }}</option>
                <option *ngFor="let n of nurseOptions" [value]="n">{{ n }}</option>
              </select>
            </div>
            <div class="col-md-3 d-flex gap-2">
              <button type="submit" class="btn btn-primary btn-custom-blue w-50">{{ t('crud.actions.search') }}</button>
              <button type="button" (click)="onReset()" class="btn btn-outline btn-custom-outline w-50">{{ t('crud.actions.reset') }}</button>
            </div>
          </div>
        </form>
      </div>

      <div class="card card-custom p-4">
        <app-sortable-table
          [columns]="tableColumns"
          [data]="tableFilteredRecords()"
          [totalItems]="totalElements"
          [page]="currentPage"
          [pageSize]="pageSize"
          [currentSort]="tableSort"
          (sortChange)="onTableSortChange($event)"
          (pageChange)="loadPage($event)">
        </app-sortable-table>
      </div>
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
export class TicketsManagementComponent implements OnInit, AfterViewInit {
  filterForm!: FormGroup;
  filters = {
    realm: '',
    project: '',
    patientId: '',
    nurseId: '',
    status: ''
  };
  tickets: TicketRecord[] = [];
  // sort state for table (used to request backend or in-memory sort)
  tableSort: { active?: string; direction?: 'asc' | 'desc' | null } = { active: 'visitDate', direction: 'desc' };
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
  nurseOptions: string[] = [];
  statusOptions: string[] = [];
  selectedTicket: TicketRecord | null = null;
  closingTicketId: number | null = null;
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(
    private readonly http: HttpClient,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  // initialize reactive form
  private initFilterForm(): void {
    this.filterForm = new FormBuilder().group({
      realm: [''],
      project: [''],
      patientId: [''],
      nurseId: [''],
      status: ['']
    });
  }

  onSearch(): void {
    const v = this.filterForm.value ?? {};
    this.filters.realm = v.realm ?? '';
    this.filters.project = v.project ?? '';
    this.filters.patientId = v.patientId ?? '';
    this.filters.nurseId = v.nurseId ?? '';
    this.filters.status = v.status ?? '';
    this.loadPage(0);
  }

  onReset(): void {
    this.filterForm.reset({ realm: '', project: '', patientId: '', nurseId: '', status: '' });
    this.resetFilters();
  }

  // restore internal filters state and reload first page
  private resetFilters(): void {
    this.filters = { realm: '', project: '', patientId: '', nurseId: '', status: '' };
    this.loadPage(0);
  }

  ngOnInit(): void {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe((translations: Record<string, string>) => {
      this.translations = translations;
      this.loadFilterOptions(true);
      this.initTableColumns();
    });
    this.initFilterForm();
  }

  tableColumns: SortColumn[] = [];

  @ViewChild('actionsTpl', { static: false }) actionsTpl?: TemplateRef<any>;

  ngAfterViewInit(): void {
    // assign templates when available
    setTimeout(() => {
      if (!this.tableColumns || this.tableColumns.length === 0) return;
      this.tableColumns = this.tableColumns.map((c) => {
        if (c.key === '__actions') {
          return { ...c, customTemplate: this.actionsTpl ?? null };
        }
        return c;
      });
    });
  }

  // handle sort change from sortable-table
  onTableSortChange(sort: { active?: string; direction?: 'asc' | 'desc' | null }): void {
    this.tableSort = { active: sort?.active, direction: sort?.direction ?? null };
    // if backend supports sort param we'll request first page with sort
    this.loadPage(0);
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
        ticket.patientCode ?? '',
        ticket.patientName ?? '',
        ticket.patientDisplay ?? '',
        ticket.therapeuticPlanId ?? '',
        ticket.ticketType ?? '',
        ticket.status ?? '',
        ticket.title ?? '',
        ticket.description ?? '',
        ticket.visitDateFormatted ?? '',
        ticket.prevalentNurseName ?? '',
        ticket.hospitalDepartment ?? ''
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
        this.selectedTicket = this.enrichTicketRecord(loadedTicket);
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
        const enriched = this.enrichTicketRecord(updatedTicket);
        this.tickets = this.tickets.map((currentTicket) => currentTicket.id === enriched.id ? enriched : currentTicket);
        if (this.selectedTicket?.id === enriched.id) {
          this.selectedTicket = enriched;
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
    if (this.filters.nurseId && this.filters.nurseId.trim()) {
      params = params.set('nurseId', this.filters.nurseId.trim());
    }
    if (this.filters.status.trim()) {
      params = params.set('status', this.filters.status.trim());
    }

    this.http.get<TicketFilterOptions>(`${environment.ticketApiBaseUrl}/tickets/filter-options`, { params }).subscribe({
      next: (response) => {
        this.realmOptions = response.realms ?? [];
        this.projectOptions = response.projects ?? [];
        this.patientOptions = response.patientIds ?? [];
        this.nurseOptions = response.nurseIds ?? [];
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
        this.nurseOptions = [];
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
    if (this.filters.nurseId && !this.nurseOptions.includes(this.filters.nurseId)) {
      this.filters.nurseId = '';
    }
    if (this.filters.status && !this.statusOptions.includes(this.filters.status)) {
      this.filters.status = '';
    }
  }

  // translation helper
  t(key: string, fallback?: string): string {
    return this.translations?.[key] ?? fallback ?? key;
  }

  // initialize columns shown in the sortable table
  private initTableColumns(): void {
    this.tableColumns = [
      { key: 'id', label: this.t('tickets.column.id'), sortable: true },
      { key: 'patientDisplay', label: this.t('tickets.column.patient') || 'Paziente', sortable: true },
      { key: 'visitDateFormatted', label: this.t('tickets.column.visitDate') || 'Data Visita', sortable: true },
      { key: 'prevalentNurseName', label: this.t('tickets.column.prevalentNurse') || 'Infermiere', sortable: true },
      { key: 'hospitalDepartment', label: this.t('tickets.column.hospitalDepartment') || 'Ospedale / Reparto', sortable: true },
      { key: 'status', label: this.t('tickets.column.status'), sortable: true },
      
      { key: '__actions', label: this.t('common.actions') || 'Actions', sortable: false }
    ];
  }

  // load a page of tickets from backend, honoring filters and sort
  loadPage(page: number): void {
    const paramsObj: { [k: string]: string } = {};
    paramsObj['page'] = String(page ?? 0);
    paramsObj['size'] = String(this.pageSize ?? 20);

    if (this.filters.realm?.trim()) paramsObj['realm'] = this.filters.realm.trim();
    if (this.filters.project?.trim()) paramsObj['project'] = this.filters.project.trim();
    if (this.filters.patientId?.trim()) paramsObj['patientId'] = this.filters.patientId.trim();
    if (this.filters.status?.trim()) paramsObj['status'] = this.filters.status.trim();

    if (this.tableSort?.active && this.tableSort?.direction) {
      paramsObj['sort'] = `${this.tableSort.active},${this.tableSort.direction}`;
    }

    let params = new HttpParams();
    Object.keys(paramsObj).forEach((k) => { params = params.set(k, paramsObj[k]); });

    this.http.get<TicketPageResponse>(`${environment.ticketApiBaseUrl}/tickets/search`, { params }).subscribe({
      next: (resp) => {
        this.tickets = (resp.content ?? []).map((t) => this.enrichTicketRecord(t));
        this.totalPages = resp.totalPages ?? 1;
        this.totalElements = resp.totalElements ?? (this.tickets.length ?? 0);
        this.pageSize = resp.size ?? this.pageSize;
        this.currentPage = resp.number ?? page ?? 0;
      },
      error: (err: { error?: ProblemDetailPayload }) => {
        this.showErrorMessage(err, 'tickets.messages.loadError');
      }
    });
  }

  // parse contentJson and populate helper fields used in UI
  private enrichTicketRecord(t: TicketRecord): TicketRecord {
    const copy: TicketRecord = { ...t };
    if (copy.contentJson) {
      try {
        copy.contentParsed = JSON.parse(copy.contentJson);
      } catch (e) {
        copy.contentParsed = null;
      }
    }

    const c = copy.contentParsed ?? {};
    // patient fields
    copy.patientId = copy.patientId ?? (c.patientId ? String(c.patientId) : copy.patientId);
    copy.patientCode = c.patientCode ?? copy.patientCode;
    copy.patientName = c.patientName ?? copy.patientName;
    copy.patientDisplay = copy.patientName ? `${copy.patientName} (${copy.patientCode ?? copy.patientId ?? '-'})` : (copy.patientCode ?? copy.patientId ?? '-');

    // visit date
    copy.visitDate = c.visitDate ?? c.startDateTime ?? copy.visitDate;
    copy.visitDateFormatted = this.formatDateTime(copy.visitDate);

    // nurse
    copy.prevalentNurseName = c.prevalentNurseName ?? copy.prevalentNurseName;

    // hospital / department
    const hospital = c.hospitalName ?? c.hospital ?? '';
    const dept = c.departmentName ?? c.department ?? '';
    copy.hospitalDepartment = hospital ? (dept ? `${hospital} / ${dept}` : hospital) : (dept || '-');

    return copy;
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