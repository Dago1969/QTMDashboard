import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { MedicineApiService, MedicineDto } from '../../core/medicine-api.service';
import { QtmStepModalComponent } from '../../shared/qtm-step-modal.component';

type FieldType = 'text' | 'url';

interface MedicineFormModel {
  codiceAic: string;
  codFarmaco: string;
  codConfezione: string;
  denominazione: string;
  descrizione: string;
  codiceDitta: string;
  ragioneSociale: string;
  statoAmministrativo: string;
  tipoProcedura: string;
  forma: string;
  codiceAtc: string;
  paAssociati: string;
  fornitura: string;
  linkFi: string;
  linkRcp: string;
}

interface FormField {
  key: keyof MedicineFormModel;
  labelKey: string;
  type: FieldType;
}

interface FormFolder {
  key: string;
  titleKey: string;
  fields: FormField[];
}

@Component({
  selector: 'app-medicines-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, QtmStepModalComponent],
  template: `
    <qtm-step-modal
      [title]="t(pageTitleKey)"
      [step]="currentStepNumber"
      [totalSteps]="folders.length"
      [stepTitle]="t(activeFolderConfig.titleKey)"
      (close)="cancelled.emit()"
    >
      <div *ngIf="message" class="message-box" [class.message-box-error]="messageType === 'error'">
        {{ message }}
      </div>

      <div class="form-grid">
        <label *ngFor="let field of activeFields">
          <span>{{ t(field.labelKey) }}</span>
          <input
            [type]="field.type"
            [(ngModel)]="model[field.key]"
            [name]="getFieldName(field)"
            [readonly]="isViewMode"
            [disabled]="isViewMode"
          />
        </label>
      </div>

      <div modal-actions>
        <button *ngIf="!isFirstStep" type="button" class="secondary-btn" (click)="goToPreviousStep()">
          {{ t('wizard.actions.previous') }}
        </button>
        <button type="button" class="secondary-btn" (click)="cancelled.emit()">
          {{ t(isViewMode ? 'crud.actions.back' : 'crud.actions.cancel') }}
        </button>
        <button *ngIf="!isLastStep" type="button" class="primary-btn" (click)="goToNextStep()">
          {{ t('wizard.actions.next') }}
        </button>
        <button *ngIf="isLastStep && !isViewMode" type="button" class="primary-btn" (click)="save()">
          {{ t(medicineCodiceAicInput === null ? 'crud.actions.create' : 'crud.actions.update') }}
        </button>
      </div>
    </qtm-step-modal>
  `
})
export class MedicinesWizardComponent implements OnInit, OnDestroy {
  @Input() medicineCodiceAicInput: string | null = null;
  @Input() modeInput: 'create' | 'edit' | 'view' = 'create';
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly folders: FormFolder[] = [
    {
      key: 'identity',
      titleKey: 'medicines.folder.identity',
      fields: [
        { key: 'codiceAic', labelKey: 'medicines.field.codiceAic', type: 'text' },
        { key: 'codFarmaco', labelKey: 'medicines.field.codFarmaco', type: 'text' },
        { key: 'codConfezione', labelKey: 'medicines.field.codConfezione', type: 'text' },
        { key: 'denominazione', labelKey: 'medicines.field.denominazione', type: 'text' },
        { key: 'descrizione', labelKey: 'medicines.field.descrizione', type: 'text' },
        { key: 'forma', labelKey: 'medicines.field.forma', type: 'text' },
        { key: 'codiceAtc', labelKey: 'medicines.field.codiceAtc', type: 'text' }
      ]
    },
    {
      key: 'company',
      titleKey: 'medicines.folder.company',
      fields: [
        { key: 'codiceDitta', labelKey: 'medicines.field.codiceDitta', type: 'text' },
        { key: 'ragioneSociale', labelKey: 'medicines.field.ragioneSociale', type: 'text' },
        { key: 'statoAmministrativo', labelKey: 'medicines.field.statoAmministrativo', type: 'text' },
        { key: 'tipoProcedura', labelKey: 'medicines.field.tipoProcedura', type: 'text' },
        { key: 'paAssociati', labelKey: 'medicines.field.paAssociati', type: 'text' },
        { key: 'fornitura', labelKey: 'medicines.field.fornitura', type: 'text' }
      ]
    },
    {
      key: 'links',
      titleKey: 'medicines.folder.links',
      fields: [
        { key: 'linkFi', labelKey: 'medicines.field.linkFi', type: 'url' },
        { key: 'linkRcp', labelKey: 'medicines.field.linkRcp', type: 'url' }
      ]
    }
  ];

  activeFolder = 'identity';
  model: MedicineFormModel = this.createEmptyModel();
  isViewMode = false;
  pageTitleKey = 'medicines.title.new';
  message = '';
  messageType: 'success' | 'error' = 'success';
  translations: Record<string, string> = {};

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly medicineApiService: MedicineApiService,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
        next: (translationMap) => {
          this.translations = translationMap;
          this.isViewMode = this.modeInput === 'view';
          this.pageTitleKey = this.isViewMode ? 'medicines.title.view' : this.medicineCodiceAicInput === null ? 'medicines.title.new' : 'medicines.title.edit';
          if (this.medicineCodiceAicInput !== null) {
            this.loadMedicine(this.medicineCodiceAicInput);
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get activeFields(): FormField[] {
    return this.activeFolderConfig.fields;
  }

  get activeFolderConfig(): FormFolder {
    return this.folders.find((folder) => folder.key === this.activeFolder) ?? this.folders[0];
  }

  get currentStepNumber(): number {
    return Math.max(this.folders.findIndex((folder) => folder.key === this.activeFolder), 0) + 1;
  }

  get isFirstStep(): boolean {
    return this.currentStepNumber === 1;
  }

  get isLastStep(): boolean {
    return this.currentStepNumber === this.folders.length;
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  getFieldName(field: FormField): string {
    return String(field.key);
  }

  goToPreviousStep(): void {
    const previousIndex = Math.max(this.currentStepNumber - 2, 0);
    this.activeFolder = this.folders[previousIndex].key;
  }

  goToNextStep(): void {
    const nextIndex = Math.min(this.currentStepNumber, this.folders.length - 1);
    this.activeFolder = this.folders[nextIndex].key;
  }

  save(): void {
    const payload = this.toPayload();
    const request = this.medicineCodiceAicInput === null
      ? this.medicineApiService.createMedicine(payload)
      : this.medicineApiService.updateMedicine(this.medicineCodiceAicInput, payload);

    this.subscriptions.add(
      request.subscribe({
        next: () => this.saved.emit(),
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'medicines.error.save');
        }
      })
    );
  }

  private loadMedicine(codiceAic: string): void {
    this.subscriptions.add(
      this.medicineApiService.getMedicine(codiceAic).subscribe({
        next: (medicine) => {
          this.model = {
            ...this.createEmptyModel(),
            ...medicine
          };
        },
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'medicines.error.load');
        }
      })
    );
  }

  private toPayload(): MedicineDto {
    return {
      codiceAic: this.model.codiceAic,
      codFarmaco: this.model.codFarmaco,
      codConfezione: this.model.codConfezione,
      denominazione: this.model.denominazione,
      descrizione: this.model.descrizione || undefined,
      codiceDitta: this.model.codiceDitta || undefined,
      ragioneSociale: this.model.ragioneSociale || undefined,
      statoAmministrativo: this.model.statoAmministrativo || undefined,
      tipoProcedura: this.model.tipoProcedura || undefined,
      forma: this.model.forma || undefined,
      codiceAtc: this.model.codiceAtc || undefined,
      paAssociati: this.model.paAssociati || undefined,
      fornitura: this.model.fornitura || undefined,
      linkFi: this.model.linkFi || undefined,
      linkRcp: this.model.linkRcp || undefined
    };
  }

  private createEmptyModel(): MedicineFormModel {
    return {
      codiceAic: '',
      codFarmaco: '',
      codConfezione: '',
      denominazione: '',
      descrizione: '',
      codiceDitta: '',
      ragioneSociale: '',
      statoAmministrativo: '',
      tipoProcedura: '',
      forma: '',
      codiceAtc: '',
      paAssociati: '',
      fornitura: '',
      linkFi: '',
      linkRcp: ''
    };
  }

  private extractErrorMessage(error: HttpErrorResponse, fallbackKey: string): string {
    const detail = error.error?.detail;
    return typeof detail === 'string' && detail.length > 0 ? detail : this.t(fallbackKey);
  }
}