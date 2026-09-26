import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { I18nPropertiesService } from '../core/i18n-properties.service';

const AUTO_DISMISS_DELAY_MS = 4000;

export interface SearchOption {
  value: string;
  labelKey?: string;
  label?: string;
}

export interface SearchFilterField {
  key: string;
  labelKey: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: SearchOption[];
}

export interface SearchResultColumn<T = any> {
  key: string;
  labelKey: string;
  formatter?: (row: T) => string;
  action?: (row: T) => 'primary' | 'secondary' | null;
  visible?: (row: T) => boolean;
}

export interface SearchPageActionEvent<T = any> {
  id: string | number;
  row: T;
}

export interface SearchFilterChangeEvent {
  key: string;
  value: string;
}

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="search-page modern-search">
      <div class="search-header dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ translate(titleKey) }}</h2>
          <p>{{ translate(subtitleKey) }}</p>
        </div>

        <div class="search-header-actions">
          <button class="btn btn-outline" type="button" (click)="showFilters = !showFilters">
            {{ translate('search.filters.toggle') }}
          </button>

          <button *ngIf="showCreateAction" class="btn btn-primary" type="button" (click)="createAction.emit()">
            {{ translate(createActionLabelKey) }}
          </button>
        </div>
      </div>

      <div *ngIf="message" class="search-log-panel">
        <div
          class="search-log-entry"
          [class.search-log-entry-success]="messageType === 'success'"
          [class.search-log-entry-error]="messageType === 'error'"
        >
          {{ message }}
        </div>
      </div>

      <div *ngIf="showFilters" class="search-filters-panel">
        <form class="search-filters-form-inline" (ngSubmit)="search()">
          <label *ngFor="let field of filters" class="search-filter-label-inline">
            <span>{{ translate(field.labelKey) }}</span>

            <input
              *ngIf="field.type === 'text' || field.type === 'number' || field.type === 'date'"
              [type]="field.type"
              [(ngModel)]="filterModel[field.key]"
              [name]="field.key"
            />

            <select
              *ngIf="field.type === 'select'"
              [(ngModel)]="filterModel[field.key]"
              [name]="field.key"
              (ngModelChange)="filterChanged.emit({ key: field.key, value: $event ?? '' })"
            >
              <option value=""></option>
              <option *ngFor="let option of field.options ?? []" [value]="option.value">
                {{ option.label ? option.label : translate(option.labelKey || '') }}
              </option>
            </select>
          </label>

          <div class="search-filters-actions-inline">
            <button type="submit" class="btn btn-primary">{{ translate('crud.actions.search') }}</button>
            <button type="button" class="btn btn-outline" (click)="resetFilters()">{{ translate('crud.actions.reset') }}</button>
          </div>
        </form>
      </div>

      <div class="modern-table">
        <div class="table-search-bar-inside">
          <ng-container *ngIf="showTableSearch; else showLens">
            <div class="table-search-input-wrapper">
              <span class="search-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="9" cy="9" r="7" stroke="#7a869a" stroke-width="2"/>
                  <line x1="14.4142" y1="14" x2="18" y2="17.5858" stroke="#7a869a" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </span>
              <input
                type="text"
                [(ngModel)]="tableSearchText"
                [ngModelOptions]="{ standalone: true }"
                [placeholder]="translate('search.table.placeholder')"
                class="table-search-input"
              />
              <button class="close-btn" type="button" (click)="closeTableSearch()" [title]="translate('search.table.close')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="4" y1="4" x2="12" y2="12" stroke="#7a869a" stroke-width="2" stroke-linecap="round"/>
                  <line x1="12" y1="4" x2="4" y2="12" stroke="#7a869a" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </ng-container>

          <ng-template #showLens>
            <button class="table-search-btn" type="button" (click)="showTableSearch = true" [title]="translate('search.table.open')">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="7" stroke="#7a869a" stroke-width="2"/>
                <line x1="14.4142" y1="14" x2="18" y2="17.5858" stroke="#7a869a" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </ng-template>
        </div>

        <table class="search-table" *ngIf="filteredResults().length > 0; else emptyState">
          <thead>
            <tr>
              <th>{{ translate('common.id') }}</th>
              <th *ngFor="let column of displayColumns">
                {{ translate(column.labelKey) }}
              </th>
              <th *ngIf="hasActions">{{ translate('search.actions') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr *ngFor="let row of pagedResults()">
              <td>{{ getRowId(row) }}</td>
              <td *ngFor="let column of displayColumns">{{ getCellValue(column, row) }}</td>
              <td *ngIf="hasActions" class="actions">
                <ng-container *ngTemplateOutlet="rowActionsTemplate; context: { $implicit: row }"></ng-container>
                <button
                  *ngFor="let column of actionColumns"
                  [hidden]="column.visible && !column.visible(row)"
                  class="btn btn-sm"
                  [class.btn-primary]="column.action?.(row) === 'primary'"
                  [class.btn-secondary]="column.action?.(row) === 'secondary'"
                  type="button"
                  (click)="actionColumn.emit({ column, event: toActionEvent(row) })"
                >
                  {{ getCellValue(column, row) }}
                </button>
                <button *ngIf="showViewAction" class="icon-btn" type="button" (click)="viewAction.emit(toActionEvent(row))" [title]="translate('search.action.view')">
                  <span class="icon">👁️</span>
                </button>
                <button *ngIf="showEditAction" class="icon-btn" type="button" (click)="editAction.emit(toActionEvent(row))" [title]="translate('search.action.edit')">
                  <span class="icon">✏️</span>
                </button>
                <button *ngIf="showDeleteAction" class="icon-btn" type="button" (click)="deleteAction.emit(toActionEvent(row))" [title]="translate('search.action.delete')">
                  <span class="icon">🗑️</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <ng-template #emptyState>
          <p class="empty-state">{{ translate(emptyStateKey) }}</p>
        </ng-template>

        <div class="search-pagination asl-pagination" *ngIf="filteredResults().length > 0">
          <span class="asl-pagination-count">{{ pageEnd() }} di {{ filteredResults().length }} Pag {{ currentPage + 1 }}</span>
          <div class="asl-pagination-buttons">
            <button class="btn btn-outline asl-pagination-button" type="button" (click)="currentPage = currentPage - 1" [disabled]="currentPage === 0">&lt;</button>
            <button class="btn btn-outline asl-pagination-button" type="button" (click)="currentPage = currentPage + 1" [disabled]="currentPage >= pageCount() - 1">&gt;</button>
          </div>
        </div>
      </div>
    </section>
  `
})
export class SearchPageComponent<T = any> implements OnInit, OnDestroy {
  @Input({ required: true }) titleKey!: string;
  @Input({ required: true }) subtitleKey!: string;
  @Input({ required: true }) emptyStateKey!: string;
  @Input({ required: true }) filters: SearchFilterField[] = [];
  @Input({ required: true }) columns: SearchResultColumn<T>[] = [];
  @Input({ required: true }) fetchResults!: (filters: Record<string, string>) => Observable<T[]>;
  @Input() createActionLabelKey = 'crud.actions.new';
  @Input() errorFallbackKey = 'crud.error.search';
  @Input() searchSuccessKey = 'search.success.completed';
  @Input() rowIdKey = 'id';
  @Input() showCreateAction = true;
  @Input() showViewAction = true;
  @Input() showEditAction = true;
  @Input() showDeleteAction = false;
  @Input() initialFilters: Record<string, string> = {};
  @Input() rowActionsTemplate: TemplateRef<{ $implicit: T }> | null = null;

  @Output() readonly createAction = new EventEmitter<void>();
  @Output() readonly viewAction = new EventEmitter<SearchPageActionEvent<T>>();
  @Output() readonly editAction = new EventEmitter<SearchPageActionEvent<T>>();
  @Output() readonly deleteAction = new EventEmitter<SearchPageActionEvent<T>>();
  @Output() readonly actionColumn = new EventEmitter<{ column: SearchResultColumn<T>; event: SearchPageActionEvent<T> }>();
  @Output() readonly filterChanged = new EventEmitter<SearchFilterChangeEvent>();

  results: T[] = [];
  filterModel: Record<string, string> = {};
  translations: Record<string, string> = {};
  message = '';
  messageType: 'success' | 'error' = 'success';
  showFilters = true;
  showTableSearch = false;
  tableSearchText = '';
  pageSize = 20;
  currentPage = 0;
  sortKey = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  private readonly subscriptions = new Subscription();
  private messageTimeoutId: number | null = null;

  constructor(
    private readonly i18nPropertiesService: I18nPropertiesService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.filterModel = { ...this.initialFilters };
    this.subscriptions.add(
      this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
        next: (translationMap) => {
          this.translations = translationMap;
          this.consumeFlashMessage();
          this.search(false);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.clearMessageTimer();
    this.subscriptions.unsubscribe();
  }

  get hasActions(): boolean {
    return this.showViewAction || this.showEditAction || this.showDeleteAction || this.rowActionsTemplate !== null || this.actionColumns.length > 0;
  }

  get actionColumns(): SearchResultColumn<T>[] {
    return this.columns.filter((column) => column.action !== undefined);
  }

  get displayColumns(): SearchResultColumn<T>[] {
    return this.columns.filter((column) => column.action === undefined);
  }

  translate(key: string): string {
    return this.translations[key] ?? key;
  }

  search(showFeedback = true): void {
    this.subscriptions.add(
      this.fetchResults(this.buildSearchFilters()).subscribe({
        next: (results) => {
          this.results = results;
          this.currentPage = 0;
          if (showFeedback) {
            this.showExternalMessage(this.translate(this.searchSuccessKey));
          }
        },
        error: (error: HttpErrorResponse) => {
          this.showExternalMessage(this.extractErrorMessage(error, this.errorFallbackKey), 'error');
        }
      })
    );
  }

  reload(showFeedback = false): void {
    this.search(showFeedback);
  }

  resetFilters(): void {
    this.filterModel = { ...this.initialFilters };
    this.search(false);
  }

  filteredResults(): T[] {
    const normalizedSearch = this.tableSearchText.trim().toLowerCase();
    const filtered = !normalizedSearch ? this.results : this.results.filter((row) => {
      const haystack = [
        String(this.getRowId(row)),
        ...this.columns.map((column) => this.getCellValue(column, row))
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    if (!this.sortKey) {
      return filtered;
    }
    return [...filtered].sort((first, second) => {
      const left = this.getCellValue(this.columns.find((column) => column.key === this.sortKey)!, first).toLocaleLowerCase();
      const right = this.getCellValue(this.columns.find((column) => column.key === this.sortKey)!, second).toLocaleLowerCase();
      return left.localeCompare(right) * (this.sortDirection === 'asc' ? 1 : -1);
    });
  }

  pagedResults(): T[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredResults().slice(start, start + this.pageSize);
  }

  pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredResults().length / this.pageSize));
  }

  pageStart(): number {
    return this.filteredResults().length === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  pageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.filteredResults().length);
  }

  toggleSort(key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.currentPage = 0;
  }

  getRowId(row: T): string | number {
    const value = (row as Record<string, unknown>)[this.rowIdKey];
    return typeof value === 'number' || typeof value === 'string' ? value : '';
  }

  getCellValue(column: SearchResultColumn<T>, row: T): string {
    if (column.formatter) {
      return column.formatter(row);
    }

    const value = (row as Record<string, unknown>)[column.key];
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    return String(value);
  }

  toActionEvent(row: T): SearchPageActionEvent<T> {
    return {
      id: this.getRowId(row),
      row
    };
  }

  closeTableSearch(): void {
    this.tableSearchText = '';
    this.showTableSearch = false;
  }

  showExternalMessage(message: string, type: 'success' | 'error' = 'success', persistent = false): void {
    this.clearMessageTimer();
    this.messageType = type;
    this.message = message;

    if (persistent || !message) {
      return;
    }

    const activeMessage = message;
    this.messageTimeoutId = window.setTimeout(() => {
      if (this.message === activeMessage) {
        this.message = '';
        this.changeDetectorRef.detectChanges();
      }
    }, AUTO_DISMISS_DELAY_MS);
  }

  private buildSearchFilters(): Record<string, string> {
    return Object.entries(this.filterModel).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value !== undefined && value !== null && String(value).trim().length > 0) {
        accumulator[key] = String(value).trim();
      }
      return accumulator;
    }, {});
  }

  private extractErrorMessage(error: HttpErrorResponse, fallbackKey: string): string {
    const detail = error.error?.detail;
    return typeof detail === 'string' && detail.length > 0 ? detail : this.translate(fallbackKey);
  }

  private consumeFlashMessage(): void {
    const state = window.history.state as { flashMessage?: string; flashMessageType?: 'success' | 'error' } | null;
    if (!state?.flashMessage) {
      return;
    }

    this.showExternalMessage(state.flashMessage, state.flashMessageType ?? 'success');

    const nextState = { ...state };
    delete nextState.flashMessage;
    delete nextState.flashMessageType;
    window.history.replaceState(nextState, document.title, `${window.location.pathname}${window.location.search}${window.location.hash}`);
  }

  private clearMessageTimer(): void {
    if (this.messageTimeoutId !== null) {
      window.clearTimeout(this.messageTimeoutId);
      this.messageTimeoutId = null;
    }
  }
}