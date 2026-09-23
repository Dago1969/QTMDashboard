import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select2 } from 'ng-select2-component';
import { Subscription } from 'rxjs';
import intlTelInput, { type AllOptions, type Iti } from 'intl-tel-input';
import { PatientApiService, PatientDto } from '../../core/patient-api.service';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { QtmStepModalComponent } from '../../shared/qtm-step-modal.component';
import { environment } from '../../../environments/environment';

type FieldType = 'text' | 'number' | 'checkbox' | 'datetime-local' | 'date' | 'select';

interface PatientFormModel {
  assistedId?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  fiscalCode: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  regionId: string;
  region: string;
  provinceId: string;
  province: string;
  cityId: string;
  city: string;
  deliveryAddress: string;
  secondaryAddresses: string;
  communicationChannels: string;
  identificationDocumentReference: string;
  dataProcessingConsent: boolean;
  dataProcessingConsentDateTime: string;
  patientConsentOtpCode?: string;
  dataProcessingConsentRevocationLog: string;
  additionalConsents: string;
  therapyStatus: string;
  prescribingSpecialist: string;
  referenceHospitalStructure: string;
  referencePharmacy: string;
  preferredPickupPharmacy: string;
  deliveryMode: string;
  reminderEnabled: boolean;
  caregiverFullName: string;
  caregiverPhone: string;
  caregiverRelationship: string;
  otpRecipient: string;
  preferredContact: string;
  structureId: string;
}

interface FormField {
  key: keyof PatientFormModel;
  labelKey: string;
  type: FieldType;
  required?: boolean;
  readonly?: boolean;
  options?: Array<{ value: string; labelKey: string }>;
}

interface FormFolder {
  key: string;
  titleKey: string;
  fields: FormField[];
}

interface GeographicOption {
  id: number;
  name: string;
}

interface PhoneInputBinding {
  fieldKey: keyof PatientFormModel;
  input: HTMLInputElement;
  iti: Iti;
  syncValue: () => void;
  cleanup: () => void;
}

interface ConsentOtpState {
  pending: boolean;
  sent: boolean;
  verified: boolean;
  destination: string;
  statusKey: string | null;
}

@Component({
  selector: 'app-patients-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, Select2, QtmStepModalComponent],
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
        <ng-container *ngFor="let field of activeFields; let i = index">
          <label
            *ngIf="!(field.key === 'provinceId' && i > 0 && activeFields[i-1]?.key === 'regionId') && !(field.key === 'cityId' && i > 0 && activeFields[i-1]?.key === 'provinceId' && i > 1 && activeFields[i-2]?.key === 'regionId')"
            [style.grid-column]="field.key === 'regionId' ? '1 / -1' : null"
          >
          <span>{{ t(field.labelKey) }}</span>

          <ng-container *ngIf="field.key === 'regionId'; else normalField">
            <div class="location-row">
              <div class="location-item">
                <ng-select2
                  class="qtm-select2-field"
                  [(ngModel)]="model.regionId"
                  name="regionId"
                  [data]="toSelect2Data(regions)"
                  (update)="onFieldValueChange('regionId')"
                  [placeholder]="t('patients.field.region')"
                  [displaySearchStatus]="'hidden'"
                  [resettable]="true"
                ></ng-select2>
              </div>
              <div class="location-item">
                <ng-select2
                  class="qtm-select2-field"
                  [(ngModel)]="model.provinceId"
                  name="provinceId"
                  [data]="toSelect2Data(provinces)"
                  (update)="onFieldValueChange('provinceId')"
                  [placeholder]="t('patients.field.province')"
                  [displaySearchStatus]="'hidden'"
                  [resettable]="true"
                ></ng-select2>
              </div>
              <div class="location-item">
                <ng-select2
                  class="qtm-select2-field"
                  [(ngModel)]="model.cityId"
                  name="cityId"
                  [data]="toSelect2Data(cities)"
                  (update)="onFieldValueChange('cityId')"
                  [placeholder]="t('patients.field.city')"
                  [displaySearchStatus]="'hidden'"
                  [resettable]="true"
                ></ng-select2>
              </div>
            </div>
          </ng-container>

          <ng-template #normalField>
          <div *ngIf="isPhoneField(field); else defaultInput" class="phone-input-group-intl" [class.phone-field-invalid]="shouldShowPhoneRequiredError(field)">
            <input
              #phoneInputElement
              class="phone-number-input"
              type="tel"
              [attr.data-phone-field-key]="field.key"
              [name]="getFieldName(field)"
              [disabled]="field.readonly || isViewMode"
              (blur)="onPhoneFieldBlur(field)"
            />
          </div>

          <ng-template #defaultInput>
            <input
              *ngIf="field.type !== 'checkbox' && field.type !== 'select'"
              [type]="field.type"
              [(ngModel)]="model[field.key]"
              [name]="getFieldName(field)"
              [readonly]="field.readonly || isViewMode"
              [disabled]="field.readonly || isViewMode"
            />
            <select
              *ngIf="field.type === 'select'"
              [(ngModel)]="model[field.key]"
              [name]="getFieldName(field)"
              [disabled]="field.readonly || isViewMode"
              (ngModelChange)="onFieldValueChange(field)"
            >
              <option value=""></option>
              <option *ngFor="let option of getOptions(field)" [value]="option.value">{{ t(option.labelKey) }}</option>
            </select>
            <input
              *ngIf="field.type === 'checkbox'"
              type="checkbox"
              [(ngModel)]="model[field.key]"
              [name]="getFieldName(field)"
              [disabled]="isViewMode"
              class="checkbox-input"
            />
          </ng-template>

          <small *ngIf="shouldShowPhoneRequiredError(field)" class="field-error">
            {{ t('crud.validation.required') }}
          </small>
          </ng-template>
          </label>
        </ng-container>
      </div>

      <div *ngIf="activeFolder === 'privacy'" class="otp-block">
        <div *ngIf="consentOtpState.destination" class="message-box message-box-success">{{ consentOtpState.destination }}</div>
        <div *ngIf="consentOtpState.statusKey" class="message-box">{{ t(consentOtpState.statusKey) }}</div>

        <div class="otp-controls">
          <button type="button" class="secondary-btn" [disabled]="consentOtpState.pending || !hasConsentPrimaryPhone()" (click)="sendConsentOtp()">
            {{ t('patients.privacy.otp.sendAction') }}
          </button>

          <input
            class="otp-code-input"
            type="text"
            inputmode="numeric"
            maxlength="6"
            (keypress)="onlyNumbers($event)"
            (input)="onOtpInput($event)"
            [(ngModel)]="model.patientConsentOtpCode"
            name="patientConsentOtpCode"
            [disabled]="consentOtpState.pending || !consentOtpState.sent"
            placeholder="{{ t('patients.privacy.otp.code') }}"
          />

          <button type="button" class="secondary-btn" [disabled]="consentOtpState.pending || !consentOtpState.sent || !model.patientConsentOtpCode" (click)="verifyConsentOtp()">
            {{ t('patients.privacy.otp.verifyAction') }}
          </button>
        </div>
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
          {{ t(patientIdInput === null ? 'crud.actions.create' : 'crud.actions.update') }}
        </button>
      </div>
    </qtm-step-modal>
  `
  ,
  styles: [
    `
    .location-row { display: flex; gap: 12px; align-items: center; }
    .location-item { flex: 1; }
    .location-item select { width: 100%; }
    `
  ]
})
export class PatientsWizardComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly defaultPhoneCountryIsoCode = 'it';
  readonly phoneCountryOrder: NonNullable<AllOptions['countryOrder']> = ['it', 'us', 'gb', 'fr', 'de', 'es'];
  readonly loadPhoneInputUtils = () => import('intl-tel-input/utils');
  @Input() patientIdInput: number | null = null;
  @Input() modeInput: 'create' | 'edit' | 'view' = 'create';
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly folders: FormFolder[] = [
    {
      key: 'identity',
      titleKey: 'patients.folder.identity',
      fields: [
        { key: 'assistedId', labelKey: 'patients.field.assistedId', type: 'text', readonly: true },
        { key: 'firstName', labelKey: 'patients.field.firstName', type: 'text', required: true },
        { key: 'lastName', labelKey: 'patients.field.lastName', type: 'text', required: true },
        { key: 'birthDate', labelKey: 'patients.field.birthDate', type: 'date', required: true },
        {
          key: 'gender',
          labelKey: 'patients.field.gender',
          type: 'select',
          options: [
            { value: 'M', labelKey: 'patients.gender.male' },
            { value: 'F', labelKey: 'patients.gender.female' }
          ]
        },
        { key: 'fiscalCode', labelKey: 'patients.field.fiscalCode', type: 'text' },
        { key: 'email', labelKey: 'patients.field.email', type: 'text' },
        { key: 'primaryPhone', labelKey: 'patients.field.primaryPhone', type: 'text' },
        { key: 'secondaryPhone', labelKey: 'patients.field.secondaryPhone', type: 'text' },
        { key: 'caregiverFullName', labelKey: 'patients.field.caregiverFullName', type: 'text' },
        { key: 'caregiverPhone', labelKey: 'patients.field.caregiverPhone', type: 'text' },
        { key: 'caregiverRelationship', labelKey: 'patients.field.caregiverRelationship', type: 'select', options: [
          { value: 'familiare', labelKey: 'patients.caregiver.relationship.familiare' },
          { value: 'amico', labelKey: 'patients.caregiver.relationship.amico' },
          { value: 'collaboratore', labelKey: 'patients.caregiver.relationship.collaboratore' }
        ] },
        { key: 'regionId', labelKey: 'patients.field.region', type: 'select' },
        { key: 'provinceId', labelKey: 'patients.field.province', type: 'select' },
        { key: 'cityId', labelKey: 'patients.field.city', type: 'select' },
        { key: 'deliveryAddress', labelKey: 'patients.field.deliveryAddress', type: 'text' },
        { key: 'secondaryAddresses', labelKey: 'patients.field.secondaryAddresses', type: 'text' },
        { key: 'communicationChannels', labelKey: 'patients.field.communicationChannels', type: 'text' },
        { key: 'identificationDocumentReference', labelKey: 'patients.field.identificationDocumentReference', type: 'text' }
      ]
    },
    {
      key: 'privacy',
      titleKey: 'patients.folder.privacy',
      fields: [
        { key: 'dataProcessingConsent', labelKey: 'patients.field.dataProcessingConsent', type: 'checkbox' },
        { key: 'otpRecipient', labelKey: 'patients.field.otpRecipient', type: 'select', options: [
          { value: 'primaryPhone', labelKey: 'patients.otp.recipient.primary' },
          { value: 'caregiverPhone', labelKey: 'patients.otp.recipient.caregiver' }
        ] },
        { key: 'dataProcessingConsentDateTime', labelKey: 'patients.field.dataProcessingConsentDateTime', type: 'datetime-local' },
        { key: 'dataProcessingConsentRevocationLog', labelKey: 'patients.field.dataProcessingConsentRevocationLog', type: 'text' },
        { key: 'additionalConsents', labelKey: 'patients.field.additionalConsents', type: 'text' }
      ]
    },
    {
      key: 'medical',
      titleKey: 'patients.folder.medical',
      fields: [
        { key: 'therapyStatus', labelKey: 'patients.field.therapyStatus', type: 'text' },
        { key: 'prescribingSpecialist', labelKey: 'patients.field.prescribingSpecialist', type: 'text' },
        { key: 'referenceHospitalStructure', labelKey: 'patients.field.referenceHospitalStructure', type: 'text' },
        { key: 'referencePharmacy', labelKey: 'patients.field.referencePharmacy', type: 'text' },
        { key: 'preferredPickupPharmacy', labelKey: 'patients.field.preferredPickupPharmacy', type: 'text' },
        { key: 'deliveryMode', labelKey: 'patients.field.deliveryMode', type: 'text' },
        { key: 'reminderEnabled', labelKey: 'patients.field.reminderEnabled', type: 'checkbox' },
        { key: 'preferredContact', labelKey: 'patients.field.preferredContact', type: 'text' },
        { key: 'structureId', labelKey: 'patients.field.structureId', type: 'number' }
      ]
    }
  ];

  activeFolder = 'identity';
  model: PatientFormModel = this.createEmptyModel();
  isViewMode = false;
  pageTitleKey = 'patients.title.new';
  message = '';
  messageType: 'success' | 'error' = 'success';
  consentOtpState: ConsentOtpState = this.createConsentOtpState();
  translations: Record<string, string> = {};
  regions: GeographicOption[] = [];
  provinces: GeographicOption[] = [];
  cities: GeographicOption[] = [];
  phoneFieldTouched: Partial<Record<keyof PatientFormModel, boolean>> = {};
  @ViewChildren('phoneInputElement') phoneInputElements!: QueryList<ElementRef<HTMLInputElement>>;
  private phoneInputChangesSubscription?: Subscription;
  private phoneInputBindings = new Map<keyof PatientFormModel, PhoneInputBinding>();

  private readonly subscriptions = new Subscription();

  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event instanceof KeyboardEvent && (event.which ?? event.keyCode);
    if (!charCode) {
      return true;
    }
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onOtpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = (input.value ?? '').replace(/[^0-9]/g, '').slice(0, 6);
    if (input.value !== cleaned) {
      input.value = cleaned;
      this.model.patientConsentOtpCode = cleaned;
    }
  }

  toSelect2Data(items: GeographicOption[]): Array<{ value: string; label: string; id: string }> {
    return items.map(i => ({ value: String(i.id), label: i.name, id: String(i.id) }));
  }

  private createConsentOtpState(): ConsentOtpState {
    return { pending: false, sent: false, verified: false, destination: '', statusKey: null };
  }

  hasConsentPrimaryPhone(): boolean {
    const phone = this.getConsentPrimaryPhone();
    return typeof phone === 'string' && phone.trim().length > 0;
  }

  getConsentPrimaryPhone(): string {
    if (this.model.otpRecipient === 'caregiverPhone') {
      return this.model.caregiverPhone || '';
    }
    return this.model.primaryPhone || '';
  }

  sendConsentOtp(): void {
    const phone = this.getConsentPrimaryPhone();
    if (!phone) {
      this.messageType = 'error';
      this.message = this.t('patients.privacy.otp.error.phoneRequired');
      return;
    }

    this.consentOtpState = { ...this.consentOtpState, pending: true, statusKey: 'patients.privacy.otp.status.sending' };
    this.model.dataProcessingConsent = true;
    this.model.dataProcessingConsentDateTime = '';

    this.subscriptions.add(
      this.http.post<any>(`${environment.apiBaseUrl}/users/otp/send`, { phoneNumber: phone, channel: 'sms' }).subscribe({
        next: (result) => {
          this.consentOtpState = { pending: false, sent: true, verified: false, destination: result?.destination ?? phone, statusKey: 'patients.privacy.otp.status.sent' };
          this.messageType = 'success';
          this.message = this.t('patients.privacy.otp.success.sent');
        },
        error: () => {
          this.consentOtpState = { pending: false, sent: false, verified: false, destination: '', statusKey: 'patients.privacy.otp.error.send' };
          this.messageType = 'error';
          this.message = this.t('patients.privacy.otp.error.send');
        }
      })
    );
  }

  verifyConsentOtp(): void {
    const phone = this.getConsentPrimaryPhone();
    const code = String(this.model.patientConsentOtpCode ?? '').trim();
    if (!phone) {
      this.messageType = 'error';
      this.message = this.t('patients.privacy.otp.error.phoneRequired');
      return;
    }
    if (!code) {
      this.messageType = 'error';
      this.message = this.t('patients.privacy.otp.error.codeRequired');
      return;
    }

    this.consentOtpState = { ...this.consentOtpState, pending: true, statusKey: 'patients.privacy.otp.status.verifying' };

    this.subscriptions.add(
      this.http.post<any>(`${environment.apiBaseUrl}/users/otp/check`, { phoneNumber: phone, code, channel: 'sms' }).subscribe({
        next: (result) => {
          if (!result || !result.approved) {
            this.consentOtpState = { pending: false, sent: true, verified: false, destination: result?.destination ?? phone, statusKey: 'patients.privacy.otp.error.rejected' };
            this.model.dataProcessingConsentDateTime = '';
            this.messageType = 'error';
            this.message = this.t('patients.privacy.otp.error.rejected');
            return;
          }

          this.model.dataProcessingConsent = true;
          this.model.dataProcessingConsentDateTime = this.getCurrentDateTimeLocalInputValue();
          this.consentOtpState = { pending: false, sent: true, verified: true, destination: result.destination, statusKey: 'patients.privacy.otp.status.verified' };
          this.messageType = 'success';
          this.message = this.t('patients.privacy.otp.success.verified');
        },
        error: () => {
          this.consentOtpState = { ...this.consentOtpState, pending: false, statusKey: 'patients.privacy.otp.error.check' };
          this.messageType = 'error';
          this.message = this.t('patients.privacy.otp.error.check');
        }
      })
    );
  }

  private getCurrentDateTimeLocalInputValue(): string {
    const currentDate = new Date();
    const timezoneOffset = currentDate.getTimezoneOffset() * 60000;
    return new Date(currentDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }

  private hasConsentOtpSaveBlock(): boolean {
    return !this.consentOtpState.verified && !this.model.dataProcessingConsentDateTime;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly patientApiService: PatientApiService,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  ngOnInit(): void {
    this.loadRegions();
    this.subscriptions.add(
      this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
        next: (translationMap) => {
          this.translations = translationMap;
          this.isViewMode = this.modeInput === 'view';
          this.pageTitleKey = this.isViewMode ? 'patients.title.view' : this.patientIdInput === null ? 'patients.title.new' : 'patients.title.edit';
          if (this.patientIdInput !== null) {
            this.loadPatient(this.patientIdInput);
          }
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.syncPhoneInputs();
    this.phoneInputChangesSubscription = this.phoneInputElements.changes.subscribe(() => {
      this.syncPhoneInputs();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.phoneInputChangesSubscription?.unsubscribe();
    for (const binding of this.phoneInputBindings.values()) {
      binding.cleanup();
    }
    this.phoneInputBindings.clear();
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

  getOptions(field: FormField): Array<{ value: string; labelKey: string }> {
    if (field.key === 'regionId') {
      return this.toSelectOptions(this.regions);
    }
    if (field.key === 'provinceId') {
      return this.toSelectOptions(this.provinces);
    }
    if (field.key === 'cityId') {
      return this.toSelectOptions(this.cities);
    }
    return field.options ?? [];
  }

  getOptionsForKey(key: keyof PatientFormModel | string): Array<{ value: string; labelKey: string }> {
    if (key === 'regionId') {
      return this.toSelectOptions(this.regions);
    }
    if (key === 'provinceId') {
      return this.toSelectOptions(this.provinces);
    }
    if (key === 'cityId') {
      return this.toSelectOptions(this.cities);
    }
    return [];
  }

  onFieldValueChange(fieldOrKey: FormField | keyof PatientFormModel | string): void {
    const key = typeof fieldOrKey === 'string' ? fieldOrKey : (fieldOrKey as FormField).key as string;

    if (key === 'regionId') {
      this.model.region = this.getSelectedName(this.regions, this.model.regionId);
      this.model.provinceId = '';
      this.model.province = '';
      this.model.cityId = '';
      this.model.city = '';
      this.provinces = [];
      this.cities = [];
      if (this.model.regionId) {
        this.loadProvinces(Number(this.model.regionId));
      }
      return;
    }

    if (key === 'provinceId') {
      this.model.province = this.getSelectedName(this.provinces, this.model.provinceId);
      this.model.cityId = '';
      this.model.city = '';
      this.cities = [];
      if (this.model.provinceId) {
        this.loadCities(Number(this.model.provinceId));
      }
      return;
    }

    if (key === 'cityId') {
      this.model.city = this.getSelectedName(this.cities, this.model.cityId);
    }
  }

  isPhoneField(field: FormField): boolean {
    return field.type === 'text' && field.key.toLowerCase().includes('phone');
  }

  onPhoneFieldBlur(field: FormField): void {
    this.phoneFieldTouched[field.key] = true;
  }

  shouldShowPhoneRequiredError(field: FormField): boolean {
    if (!this.isPhoneField(field) || this.isViewMode) {
      return false;
    }

    const value = this.model[field.key];
    return this.phoneFieldTouched[field.key] === true && typeof value === 'string' && value.trim().length === 0;
  }

  goToPreviousStep(): void {
    const previousIndex = Math.max(this.currentStepNumber - 2, 0);
    this.activeFolder = this.folders[previousIndex].key;
  }

  goToNextStep(): void {
    // If leaving privacy step, require OTP verification
    if (this.activeFolder === 'privacy' && this.hasConsentOtpSaveBlock()) {
      this.messageType = 'error';
      this.message = this.t('patients.privacy.otp.error.verifyBeforeSave');
      return;
    }

    const nextIndex = Math.min(this.currentStepNumber, this.folders.length - 1);
    this.activeFolder = this.folders[nextIndex].key;
  }

  save(): void {
    this.markPhoneFieldsTouched();
    if (this.hasConsentOtpSaveBlock()) {
      this.messageType = 'error';
      this.message = this.t('patients.privacy.otp.error.verifyBeforeSave');
      return;
    }

    const payload = this.toPayload();
    const request = this.patientIdInput === null
      ? this.patientApiService.createPatient(payload)
      : this.patientApiService.updatePatient(this.patientIdInput, payload);

    this.subscriptions.add(
      request.subscribe({
        next: () => this.saved.emit(),
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'crud.error.save');
        }
      })
    );
  }

  private loadPatient(id: number): void {
    this.subscriptions.add(
      this.patientApiService.getPatient(id).subscribe({
        next: (patient) => {
          this.model = {
            ...this.createEmptyModel(),
            ...patient,
            birthDate: typeof patient.birthDate === 'string' ? patient.birthDate.slice(0, 10) : '',
            gender: typeof patient.gender === 'string' ? patient.gender : '',
            dataProcessingConsent: Boolean(patient.dataProcessingConsent),
            reminderEnabled: Boolean(patient.reminderEnabled),
            dataProcessingConsentDateTime: typeof patient.dataProcessingConsentDateTime === 'string'
              ? patient.dataProcessingConsentDateTime.slice(0, 16)
              : '',
            regionId: patient.regionId === undefined || patient.regionId === null ? '' : String(patient.regionId),
            provinceId: patient.provinceId === undefined || patient.provinceId === null ? '' : String(patient.provinceId),
            cityId: patient.cityId === undefined || patient.cityId === null ? '' : String(patient.cityId),
            structureId: patient.structureId === undefined || patient.structureId === null ? '' : String(patient.structureId)
          };
          this.loadLocationOptions(patient);
          this.syncPhoneInputs();
        },
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'crud.error.load');
        }
      })
    );
  }

  private toPayload(): PatientDto {
    return {
      assistedId: this.model.assistedId || undefined,
      firstName: this.model.firstName,
      lastName: this.model.lastName,
      birthDate: this.model.birthDate || undefined,
      gender: this.model.gender || undefined,
      fiscalCode: this.model.fiscalCode,
      email: this.model.email || undefined,
      primaryPhone: this.model.primaryPhone || undefined,
      secondaryPhone: this.model.secondaryPhone || undefined,
      regionId: this.model.regionId ? Number(this.model.regionId) : undefined,
      region: this.model.region || undefined,
      provinceId: this.model.provinceId ? Number(this.model.provinceId) : undefined,
      province: this.model.province || undefined,
      cityId: this.model.cityId ? Number(this.model.cityId) : undefined,
      city: this.model.city || undefined,
      deliveryAddress: this.model.deliveryAddress || undefined,
      secondaryAddresses: this.model.secondaryAddresses || undefined,
      communicationChannels: this.model.communicationChannels || undefined,
      identificationDocumentReference: this.model.identificationDocumentReference || undefined,
      dataProcessingConsent: this.model.dataProcessingConsent,
      dataProcessingConsentDateTime: this.model.dataProcessingConsentDateTime || undefined,
      dataProcessingConsentRevocationLog: this.model.dataProcessingConsentRevocationLog || undefined,
      additionalConsents: this.model.additionalConsents || undefined,
      therapyStatus: this.model.therapyStatus || undefined,
      prescribingSpecialist: this.model.prescribingSpecialist || undefined,
      referenceHospitalStructure: this.model.referenceHospitalStructure || undefined,
      referencePharmacy: this.model.referencePharmacy || undefined,
      preferredPickupPharmacy: this.model.preferredPickupPharmacy || undefined,
      deliveryMode: this.model.deliveryMode || undefined,
      reminderEnabled: this.model.reminderEnabled,
      caregiverFullName: this.model.caregiverFullName || undefined,
      caregiverPhone: this.model.caregiverPhone || undefined,
      caregiverRelationship: this.model.caregiverRelationship || undefined,
      otpRecipient: this.model['otpRecipient'] || undefined,
      preferredContact: this.model.preferredContact || undefined,
      structureId: this.model.structureId ? Number(this.model.structureId) : undefined
    };
  }

  private createEmptyModel(): PatientFormModel {
    return {
      assistedId: '',
      firstName: '',
      lastName: '',
      birthDate: '',
      gender: '',
      fiscalCode: '',
      email: '',
      primaryPhone: '',
      secondaryPhone: '',
      regionId: '',
      region: '',
      provinceId: '',
      province: '',
      cityId: '',
      city: '',
      deliveryAddress: '',
      secondaryAddresses: '',
      communicationChannels: '',
      identificationDocumentReference: '',
      dataProcessingConsent: false,
      dataProcessingConsentDateTime: '',
      dataProcessingConsentRevocationLog: '',
      additionalConsents: '',
      therapyStatus: '',
      prescribingSpecialist: '',
      referenceHospitalStructure: '',
      referencePharmacy: '',
      preferredPickupPharmacy: '',
      deliveryMode: '',
      reminderEnabled: false,
      caregiverFullName: '',
      caregiverPhone: '',
      caregiverRelationship: '',
      otpRecipient: 'primaryPhone',
      preferredContact: '',
      structureId: ''
    };
  }

  private loadRegions(): void {
    this.subscriptions.add(
      this.http.get<GeographicOption[]>(`${environment.apiBaseUrl}/geography/regions`).subscribe({
        next: (regions) => this.regions = regions,
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'crud.error.load');
        }
      })
    );
  }

  private loadProvinces(regionId: number): void {
    this.subscriptions.add(
      this.http.get<GeographicOption[]>(`${environment.apiBaseUrl}/geography/provinces/by-region/${regionId}`).subscribe({
        next: (provinces) => this.provinces = provinces,
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'crud.error.load');
        }
      })
    );
  }

  private loadCities(provinceId: number): void {
    this.subscriptions.add(
      this.http.get<GeographicOption[]>(`${environment.apiBaseUrl}/geography/cities/by-province/${provinceId}`).subscribe({
        next: (cities) => this.cities = cities,
        error: (error: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message = this.extractErrorMessage(error, 'crud.error.load');
        }
      })
    );
  }

  private loadLocationOptions(patient: PatientDto): void {
    if (patient.regionId !== undefined && patient.regionId !== null) {
      this.loadProvinces(patient.regionId);
    }
    if (patient.provinceId !== undefined && patient.provinceId !== null) {
      this.loadCities(patient.provinceId);
    }
  }

  private getSelectedName(options: GeographicOption[], selectedId: string): string {
    return options.find((option) => option.id === Number(selectedId))?.name ?? '';
  }

  private toSelectOptions(options: GeographicOption[]): Array<{ value: string; labelKey: string }> {
    return options.map((option) => ({ value: String(option.id), labelKey: option.name }));
  }

  private markPhoneFieldsTouched(): void {
    for (const field of this.activeFields) {
      if (this.isPhoneField(field)) {
        this.phoneFieldTouched[field.key] = true;
      }
    }
  }

  private syncPhoneInputs(): void {
    if (!this.phoneInputElements) {
      return;
    }

    const renderedKeys = new Set<keyof PatientFormModel>();

    for (const elementRef of this.phoneInputElements.toArray()) {
      const input = elementRef.nativeElement;
      const rawFieldKey = input.dataset['phoneFieldKey'];
      if (!rawFieldKey) {
        continue;
      }

      const fieldKey = rawFieldKey as keyof PatientFormModel;
      renderedKeys.add(fieldKey);

      const existingBinding = this.phoneInputBindings.get(fieldKey);
      if (existingBinding?.input === input) {
        existingBinding.syncValue();
        continue;
      }

      existingBinding?.cleanup();
      if (existingBinding) {
        this.phoneInputBindings.delete(fieldKey);
      }

      const iti = intlTelInput(input, {
        initialCountry: this.defaultPhoneCountryIsoCode,
        countryOrder: this.phoneCountryOrder,
        nationalMode: false,
        separateDialCode: true,
        loadUtils: this.loadPhoneInputUtils,
        customPlaceholder: () => ''
      });

      const syncValue = () => {
        const phoneValue = (this.model as unknown as Record<string, unknown>)[fieldKey];
        const normalizedValue = typeof phoneValue === 'string' ? phoneValue.trim() : '';
        if (normalizedValue && iti.getNumber() !== normalizedValue) {
          iti.setNumber(normalizedValue);
        }
        if (!normalizedValue && input.value) {
          input.value = '';
        }
      };

      const updateModel = () => {
        const normalizedNumber = input.value.trim().length > 0 ? iti.getNumber() || input.value.trim() : '';
        (this.model as unknown as Record<string, string>)[fieldKey] = normalizedNumber;
      };

      const handleCountryChange = () => {
        updateModel();
      };

      input.addEventListener('input', updateModel);
      input.addEventListener('countrychange', handleCountryChange);
      syncValue();

      this.phoneInputBindings.set(fieldKey, {
        fieldKey,
        input,
        iti,
        syncValue,
        cleanup: () => {
          input.removeEventListener('input', updateModel);
          input.removeEventListener('countrychange', handleCountryChange);
          iti.destroy();
        }
      });
    }

    for (const [fieldKey, binding] of this.phoneInputBindings.entries()) {
      if (!renderedKeys.has(fieldKey)) {
        binding.cleanup();
        this.phoneInputBindings.delete(fieldKey);
      }
    }
  }

  private extractErrorMessage(error: HttpErrorResponse, fallbackKey: string): string {
    const detail = error.error?.detail;
    return typeof detail === 'string' && detail.length > 0 ? detail : this.t(fallbackKey);
  }
}