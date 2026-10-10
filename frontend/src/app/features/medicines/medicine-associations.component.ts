import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QtmButtonComponent } from 'qtm-shared';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { MedicineApiService, MedicineDto, MedicinePage, MedicineSearchFilters } from '../../core/medicine-api.service';

/**
 * Gestione paginata dei farmaci che QTMTicket rende disponibili nei flussi TENAPP.
 */
@Component({
  selector: 'app-medicine-associations',
  standalone: true,
  imports: [CommonModule, FormsModule, QtmButtonComponent],
  template: `
    <section class="card dashboard-content-card medicine-associations-page">
      <header class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('medicines.associations.title') }}</h2>
          <p>{{ t('medicines.associations.subtitle') }}</p>
        </div>
        <qtm-button variant="outline" [routerLink]="['/dashboard/medicines/search']" [label]="t('medicines.associations.back')"></qtm-button>
      </header>

      <form class="search-filters-panel" (ngSubmit)="search()">
        <div class="search-filters-form-inline">
          <label *ngFor="let field of filterFields" class="search-filter-label-inline" [for]="'medicineAssociation-' + field.key">
            <span>{{ t(field.labelKey) }}</span>
            <input [id]="'medicineAssociation-' + field.key" type="text" [name]="field.key" [(ngModel)]="filterValues[field.key]" />
          </label>
          <div class="search-filters-actions-inline">
            <qtm-button type="submit" variant="primary" [label]="t('crud.actions.search')" [disabled]="loading"></qtm-button>
            <qtm-button variant="outline" [label]="t('crud.actions.reset')" [disabled]="loading" (btnClick)="resetFilters()"></qtm-button>
          </div>
        </div>
      </form>

      <p *ngIf="message" class="search-log-entry" [class.search-log-entry-error]="hasError" [class.search-log-entry-success]="!hasError">
        {{ message }}
      </p>
      <p *ngIf="loading">{{ t('medicines.associations.loading') }}</p>

      <div *ngIf="!loading && medicines.length" class="modern-table">
        <table class="search-table">
          <thead>
            <tr>
              <th>{{ t('medicines.field.codiceAic') }}</th>
              <th>{{ t('medicines.field.denominazione') }}</th>
              <th>{{ t('medicines.field.paAssociati') }}</th>
              <th>{{ t('search.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let medicine of medicines">
              <td>{{ medicine.codiceAic }}</td>
              <td>{{ medicine.denominazione }}</td>
              <td>{{ medicine.paAssociati || medicine.descrizione || '-' }}</td>
              <td>
                <div class="actions">
                  <qtm-button
                    variant="primary"
                    [label]="t('medicines.associations.associate')"
                    [disabled]="savingId === medicine.id || medicine.visibleForTenants === true"
                    (btnClick)="updateVisibility(medicine, true)"
                  ></qtm-button>
                  <qtm-button
                    variant="outline"
                    [label]="t('medicines.associations.dissociate')"
                    [disabled]="savingId === medicine.id || medicine.visibleForTenants !== true"
                    (btnClick)="updateVisibility(medicine, false)"
                  ></qtm-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <nav class="search-pagination asl-pagination" [attr.aria-label]="t('medicines.associations.pagination')">
          <div class="asl-pagination-buttons">
            <button class="btn btn-outline asl-pagination-button" type="button" (click)="goToPage(page.number - 1)" [disabled]="page.number <= 0 || loading" [attr.aria-label]="t('medicines.associations.previous')">‹</button>
            <span>{{ page.number + 1 }} / {{ page.totalPages || 1 }}</span>
            <button class="btn btn-outline asl-pagination-button" type="button" (click)="goToPage(page.number + 1)" [disabled]="page.number + 1 >= page.totalPages || loading" [attr.aria-label]="t('medicines.associations.next')">›</button>
          </div>
        </nav>
      </div>

      <p *ngIf="!loading && !medicines.length" class="empty-state">{{ t('medicines.associations.empty') }}</p>
    </section>
  `
})
export class MedicineAssociationsComponent implements OnInit {
  translations: Record<string, string> = {};
  readonly filterFields: { key: keyof MedicineSearchFilters; labelKey: string }[] = [
    { key: 'codiceAic', labelKey: 'medicines.field.codiceAic' },
    { key: 'codFarmaco', labelKey: 'medicines.field.codFarmaco' },
    { key: 'codConfezione', labelKey: 'medicines.field.codConfezione' },
    { key: 'denominazione', labelKey: 'medicines.field.denominazione' },
    { key: 'descrizione', labelKey: 'medicines.field.descrizione' },
    { key: 'codiceAtc', labelKey: 'medicines.field.codiceAtc' },
    { key: 'ragioneSociale', labelKey: 'medicines.field.ragioneSociale' },
    { key: 'statoAmministrativo', labelKey: 'medicines.field.statoAmministrativo' }
  ];
  filterValues: MedicineSearchFilters = {};
  medicines: MedicineDto[] = [];
  page: MedicinePage = { content: [], number: 0, totalPages: 0, totalElements: 0 };
  loading = false;
  savingId: number | null = null;
  message = '';
  hasError = false;

  constructor(
    private readonly medicineApiService: MedicineApiService,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  ngOnInit(): void {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe((translations) => {
      this.translations = translations;
    });
    this.loadPage(0);
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  search(): void {
    this.loadPage(0);
  }

  resetFilters(): void {
    this.filterValues = {};
    this.loadPage(0);
  }

  goToPage(pageNumber: number): void {
    if (pageNumber >= 0 && pageNumber < this.page.totalPages) {
      this.loadPage(pageNumber);
    }
  }

  updateVisibility(medicine: MedicineDto, visibleForTenants: boolean): void {
    if (medicine.id === undefined || this.savingId !== null) {
      return;
    }

    const previousValue = medicine.visibleForTenants ?? false;
    this.savingId = medicine.id;
    this.medicineApiService.updateTenantVisibility(medicine.id, visibleForTenants).subscribe({
      next: (updated) => {
        medicine.visibleForTenants = updated.visibleForTenants;
        this.savingId = null;
        this.message = this.t('medicines.associations.saved');
        this.hasError = false;
      },
      error: () => {
        medicine.visibleForTenants = previousValue;
        this.savingId = null;
        this.message = this.t('medicines.associations.error');
        this.hasError = true;
      }
    });
  }

  private loadPage(pageNumber: number): void {
    this.loading = true;
    this.message = '';
    this.medicineApiService.searchAssociations(this.filterValues, pageNumber).subscribe({
      next: (result) => {
        this.page = result;
        this.medicines = result.content ?? [];
        this.loading = false;
      },
      error: () => {
        this.medicines = [];
        this.loading = false;
        this.message = this.t('medicines.associations.error');
        this.hasError = true;
      }
    });
  }
}