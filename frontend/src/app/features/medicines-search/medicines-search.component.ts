import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { QtmButtonComponent } from 'qtm-shared';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { MedicineApiService, MedicineDto, MedicineImportResult, MedicineSearchFilters } from '../../core/medicine-api.service';
import {
  SearchFilterField,
  SearchPageActionEvent,
  SearchPageComponent,
  SearchResultColumn
} from '../../shared/search-page.component';
import { MedicinesWizardComponent } from '../medicines/medicines-wizard.component';

/**
 * Gestione farmaci tramite search-page centralizzata e wizard popup in stile TENAPP.
 */
@Component({
  selector: 'app-medicines-search',
  standalone: true,
  imports: [CommonModule, QtmButtonComponent, SearchPageComponent, MedicinesWizardComponent],
  template: `
    <div class="medicine-catalog-toolbar search-header-actions">
      <qtm-button
        variant="outline"
        [routerLink]="['/dashboard/medicines/associations']"
        [label]="t('medicines.associations.open')"
      ></qtm-button>
      <qtm-button
        variant="primary"
        [disabled]="importing"
        [label]="t(importing ? 'medicines.import.running' : 'medicines.import.action')"
        (btnClick)="importAifaCatalog()"
      ></qtm-button>
    </div>
    <div *ngIf="importMessage" class="search-log-panel">
      <div class="search-log-entry" [class.search-log-entry-success]="!importError" [class.search-log-entry-error]="importError">
        {{ importMessage }}
      </div>
    </div>
    <app-search-page
      #searchPage
      [titleKey]="'medicines.search.title'"
      [subtitleKey]="'medicines.search.subtitle'"
      [emptyStateKey]="'medicines.search.noResults'"
      [createActionLabelKey]="'medicines.actions.new'"
      [errorFallbackKey]="'medicines.error.search'"
      [filters]="searchFilters"
      [columns]="searchColumns"
      [fetchResults]="fetchMedicines"
      [useSharedButtons]="true"
      [showDeleteAction]="true"
      (createAction)="openCreate()"
      (editAction)="openEdit($event)"
      (viewAction)="openView($event)"
      (deleteAction)="delete($event)"
    />

    <app-medicines-wizard
      *ngIf="wizardOpen"
      [medicineIdInput]="selectedMedicineId"
      [modeInput]="wizardMode"
      (saved)="onSaved()"
      (cancelled)="closeWizard()"
    />
  `
})
export class MedicinesSearchComponent {
  @ViewChild('searchPage') private searchPage?: SearchPageComponent<MedicineDto>;

  readonly searchFilters: SearchFilterField[] = [
    { key: 'codiceAic', labelKey: 'medicines.field.codiceAic', type: 'text' },
    { key: 'codFarmaco', labelKey: 'medicines.field.codFarmaco', type: 'text' },
    { key: 'codConfezione', labelKey: 'medicines.field.codConfezione', type: 'text' },
    { key: 'denominazione', labelKey: 'medicines.field.denominazione', type: 'text' },
    { key: 'descrizione', labelKey: 'medicines.field.descrizione', type: 'text' },
    { key: 'codiceAtc', labelKey: 'medicines.field.codiceAtc', type: 'text' },
    { key: 'ragioneSociale', labelKey: 'medicines.field.ragioneSociale', type: 'text' },
    { key: 'statoAmministrativo', labelKey: 'medicines.field.statoAmministrativo', type: 'text' }
  ];

  readonly searchColumns: SearchResultColumn<MedicineDto>[] = [
    { key: 'codiceAic', labelKey: 'medicines.field.codiceAic' },
    { key: 'denominazione', labelKey: 'medicines.field.denominazione' },
    { key: 'descrizione', labelKey: 'medicines.field.descrizione' },
    { key: 'codiceAtc', labelKey: 'medicines.field.codiceAtc' },
    { key: 'ragioneSociale', labelKey: 'medicines.field.ragioneSociale' }
  ];

  readonly fetchMedicines = (filters: Record<string, string>): Observable<MedicineDto[]> =>
    this.medicineApiService.searchMedicines(filters as MedicineSearchFilters);

  wizardOpen = false;
  wizardMode: 'create' | 'edit' | 'view' = 'create';
  selectedMedicineId: number | null = null;

  translations: Record<string, string> = {};
  importing = false;
  importMessage = '';
  importError = false;

  constructor(
    private readonly medicineApiService: MedicineApiService,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe((translations) => {
      this.translations = translations;
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  importAifaCatalog(): void {
    if (this.importing) {
      return;
    }
    this.importing = true;
    this.importMessage = '';
    this.medicineApiService.importAifaCatalog().subscribe({
      next: (result: MedicineImportResult) => {
        this.importMessage = this.t('medicines.import.success').replace('{count}', String(result.importedRows));
        this.importError = false;
        this.importing = false;
        this.searchPage?.reload(false);
      },
      error: (error: HttpErrorResponse) => {
        this.importMessage = typeof error.error?.detail === 'string'
          ? error.error.detail
          : this.t('medicines.import.error');
        this.importError = true;
        this.importing = false;
      }
    });
  }

  openCreate(): void {
    this.selectedMedicineId = null;
    this.wizardMode = 'create';
    this.wizardOpen = true;
  }

  openEdit(event: SearchPageActionEvent<MedicineDto>): void {
    this.selectedMedicineId = Number(event.id);
    this.wizardMode = 'edit';
    this.wizardOpen = true;
  }

  openView(event: SearchPageActionEvent<MedicineDto>): void {
    this.selectedMedicineId = Number(event.id);
    this.wizardMode = 'view';
    this.wizardOpen = true;
  }

  closeWizard(): void {
    this.wizardOpen = false;
    this.selectedMedicineId = null;
  }

  onSaved(): void {
    const successKey = this.wizardMode === 'create' ? 'medicines.success.create' : 'medicines.success.update';
    this.closeWizard();
    this.searchPage?.reload(false);
    this.searchPage?.showExternalMessage(this.searchPage.translate(successKey));
  }

  delete(event: SearchPageActionEvent<MedicineDto>): void {
    if (!window.confirm(this.searchPage?.translate('medicines.search.confirmDelete') ?? '')) {
      return;
    }

    this.medicineApiService.deleteMedicine(Number(event.id)).subscribe({
      next: () => {
        this.searchPage?.reload(false);
        this.searchPage?.showExternalMessage(this.searchPage.translate('medicines.success.delete'));
      },
      error: () => {
        this.searchPage?.showExternalMessage(this.searchPage.translate('medicines.error.delete'), 'error');
      }
    });
  }
}