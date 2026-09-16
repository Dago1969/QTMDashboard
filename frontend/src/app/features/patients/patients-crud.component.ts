import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select2 } from 'ng-select2-component';
import intlTelInput, { type AllOptions, type Iti } from 'intl-tel-input';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { environment } from '../../../environments/environment';

const AUTO_DISMISS_DELAY_MS = 4000;
const PATIENTS_API_URL = `${environment.apiBaseUrl}/patients`;

type FieldType = 'text' | 'number' | 'checkbox' | 'datetime-local' | 'select';

interface PatientFormModel {
  id?: number;
  assistedId?: string;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  region: string;
  province: string;
  city: string;
  deliveryAddress: string;
  secondaryAddresses: string;
  communicationChannels: string;
  identificationDocumentReference: string;
  dataProcessingConsent: boolean;
  dataProcessingConsentDateTime: string;
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
  patientConsentOtpCode?: string;
}

interface FormField {
  key: keyof PatientFormModel;
  labelKey: string;
  type: FieldType;
  readonly?: boolean;
  options?: Array<{ value: string; labelKey: string }>;
}

interface FormFolder {
  key: string;
  titleKey: string;
  fields: FormField[];
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

/**
 * Form paziente per creazione, modifica e consultazione dentro QTMDB.
 */
@Component({
  selector: 'app-patients-crud',
  standalone: true,
  imports: [CommonModule, FormsModule, Select2],
  template: `
    <section class="page-card">
      <header class="page-header">
        <div>
          <h2>{{ t(pageTitleKey) }}</h2>
          <p *ngIf="loading">{{ t('crud.loading') }}</p>
        </div>
      </header>

      <div *ngIf="message" class="message-box" [class.message-box-error]="messageType === 'error'">
        {{ message }}
      </div>

      <div class="tabs">
        <button
          *ngFor="let folder of folders"
          type="button"
          class="tab-btn"
          [class.active]="activeFolder === folder.key"
          (click)="activeFolder = folder.key"
        >
          {{ t(folder.titleKey) }}
        </button>
      </div>

      <form class="form-grid" (ngSubmit)="save()">
        <ng-container *ngFor="let field of activeFields; let i = index">
          <label
            *ngIf="!(field.key === 'province' && i > 0 && activeFields[i-1]?.key === 'region') && !(field.key === 'city' && i > 0 && activeFields[i-1]?.key === 'province' && i > 1 && activeFields[i-2]?.key === 'region')"
            [style.grid-column]="field.key === 'region' ? 'span 3' : null"
          >
            <span>{{ t(field.labelKey) }}</span>

            <ng-container *ngIf="field.key === 'region'; else normalField">
              <div class="location-row">
                <div class="location-item">
                  <ng-select2 class="qtm-select2-field" [(ngModel)]="model.region" name="region" [data]="toSelect2DataFromText(model.region)" [placeholder]="t('patients.field.region')" [displaySearchStatus]="'hidden'" [resettable]="true"></ng-select2>
                </div>
                <div class="location-item">
                  <ng-select2 class="qtm-select2-field" [(ngModel)]="model.province" name="province" [data]="toSelect2DataFromText(model.province)" [placeholder]="t('patients.field.province')" [displaySearchStatus]="'hidden'" [resettable]="true"></ng-select2>
                </div>
                <div class="location-item">
                  <ng-select2 class="qtm-select2-field" [(ngModel)]="model.city" name="city" [data]="toSelect2DataFromText(model.city)" [placeholder]="t('patients.field.city')" [displaySearchStatus]="'hidden'" [resettable]="true"></ng-select2>
                </div>
              </div>
            </ng-container>

            <ng-template #normalField>
              <div *ngIf="isPhoneField(field); else defaultField" class="phone-input-group-intl" [class.phone-field-invalid]="shouldShowPhoneRequiredError(field)">
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

              <ng-template #defaultField>
                <input
                  *ngIf="field.type !== 'checkbox'"
                  [type]="field.type"
                  [(ngModel)]="model[field.key]"
                  [name]="getFieldName(field)"
                  [readonly]="field.readonly || isViewMode"
                  [disabled]="field.readonly || isViewMode"
                />
              </ng-template>
            </ng-template>

            <small *ngIf="shouldShowPhoneRequiredError(field)" class="field-error">
              {{ t('crud.validation.required') }}
            </small>

            <input
              *ngIf="field.type === 'checkbox'"
              type="checkbox"
              [(ngModel)]="model[field.key]"
              [name]="getFieldName(field)"
              [disabled]="isViewMode"
              class="checkbox-input"
            />
          </label>
        </ng-container>

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

        <div class="actions-row">
          <button *ngIf="!isViewMode" type="submit" class="primary-btn">
            {{ t(isEditMode ? 'crud.actions.update' : 'crud.actions.create') }}
          </button>
          <button type="button" class="secondary-btn" (click)="goBack()">
            {{ t(isViewMode ? 'crud.actions.back' : 'crud.actions.cancel') }}
          </button>
        </div>
      </form>
    </section>
  `
  ,
  styles: [
    `
    .location-row { display: flex; gap: 12px; align-items: center; }
    .location-item { flex: 1; }
    .location-item input { width: 100%; }
    `
  ]
})
export class PatientsCrudComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly defaultPhoneCountryIsoCode = 'it';
  readonly phoneCountryOrder: NonNullable<AllOptions['countryOrder']> = ['it', 'us', 'gb', 'fr', 'de', 'es'];
  readonly loadPhoneInputUtils = () => import('intl-tel-input/utils');
  readonly folders: FormFolder[] = [
    {
      key: 'identity',
      titleKey: 'patients.folder.identity',
      fields: [
        { key: 'assistedId', labelKey: 'patients.field.assistedId', type: 'text', readonly: true },
        { key: 'firstName', labelKey: 'patients.field.firstName', type: 'text' },
        { key: 'lastName', labelKey: 'patients.field.lastName', type: 'text' },
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
        { key: 'region', labelKey: 'patients.field.region', type: 'text' },
        { key: 'province', labelKey: 'patients.field.province', type: 'text' },
        { key: 'city', labelKey: 'patients.field.city', type: 'text' },
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
  loading = false;
  isViewMode = false;
  isEditMode = false;
  patientId: number | null = null;
  pageTitleKey = 'patients.title.new';
  message = '';
  messageType: 'success' | 'error' = 'success';
  translations: Record<string, string> = {};
  private messageTimeoutId: number | null = null;
  private readonly subscriptions = new Subscription();
  phoneFieldTouched: Partial<Record<keyof PatientFormModel, boolean>> = {};
  @ViewChildren('phoneInputElement') phoneInputElements!: QueryList<ElementRef<HTMLInputElement>>;
  private phoneInputChangesSubscription?: Subscription;
  private phoneInputBindings = new Map<keyof PatientFormModel, PhoneInputBinding>();

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {}

  toSelect2DataFromText(text: string | undefined): Array<{ value: string; label: string; id: string }> {
    const val = text ?? '';
    return val ? [{ value: val, label: val, id: val }] : [];
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
        next: (translationMap) => {
          this.translations = translationMap;
          const mode = this.route.snapshot.data['mode'];
          this.isViewMode = mode === 'view';

          const idParam = this.route.snapshot.paramMap.get('id');
          if (!idParam) {
            this.pageTitleKey = 'patients.title.new';
            return;
          }

          this.patientId = Number(idParam);
          this.isEditMode = true;
          this.pageTitleKey = this.isViewMode ? 'patients.title.view' : 'patients.title.edit';
          this.loadPatient(this.patientId);
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
    this.clearMessageTimer();
    this.subscriptions.unsubscribe();
    this.phoneInputChangesSubscription?.unsubscribe();
    for (const binding of this.phoneInputBindings.values()) {
      binding.cleanup();
    }
    this.phoneInputBindings.clear();
  }

  get activeFields(): FormField[] {
    return this.folders.find((folder) => folder.key === this.activeFolder)?.fields ?? [];
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  getFieldName(field: FormField): string {
    return String(field.key);
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

  save(): void {
    this.markPhoneFieldsTouched();
    if (this.hasConsentOtpSaveBlock()) {
      this.showMessage(this.t('patients.privacy.otp.error.verifyBeforeSave'), 'error');
      return;
    }
    const payload = this.toPayload();
    const request = this.patientId === null
      ? this.http.post(PATIENTS_API_URL, payload)
      : this.http.put(`${PATIENTS_API_URL}/${this.patientId}`, payload);

    this.subscriptions.add(
      request.subscribe({
        next: () => {
          void this.router.navigate(['/patients/search'], {
            state: {
              flashMessage: this.t(this.patientId === null ? 'crud.success.create' : 'crud.success.update'),
              flashMessageType: 'success'
            }
          });
        },
        error: (error: HttpErrorResponse) => {
          this.showMessage(this.extractErrorMessage(error, 'crud.error.save'), 'error');
        }
      })
    );
  }

  goBack(): void {
    void this.router.navigateByUrl('/patients/search');
  }

  private loadPatient(id: number): void {
    this.loading = true;
    this.subscriptions.add(
      this.http.get<Partial<PatientFormModel>>(`${PATIENTS_API_URL}/${id}`).subscribe({
        next: (patient) => {
          this.model = {
            ...this.createEmptyModel(),
            ...patient,
            dataProcessingConsent: Boolean(patient.dataProcessingConsent),
            reminderEnabled: Boolean(patient.reminderEnabled),
            dataProcessingConsentDateTime: typeof patient.dataProcessingConsentDateTime === 'string'
              ? patient.dataProcessingConsentDateTime.slice(0, 16)
              : '',
            structureId: patient.structureId === undefined || patient.structureId === null ? '' : String(patient.structureId)
          } as PatientFormModel;
          this.syncPhoneInputs();
          this.loading = false;
          this.clearMessage();
        },
        error: (error: HttpErrorResponse) => {
          this.loading = false;
          this.showMessage(this.extractErrorMessage(error, 'crud.error.load'), 'error');
        }
      })
    );
  }

  private toPayload(): Record<string, unknown> {
    return {
      assistedId: this.model.assistedId || null,
      firstName: this.model.firstName,
      lastName: this.model.lastName,
      fiscalCode: this.model.fiscalCode,
      email: this.model.email || null,
      primaryPhone: this.model.primaryPhone || null,
      secondaryPhone: this.model.secondaryPhone || null,
      region: this.model.region || null,
      province: this.model.province || null,
      city: this.model.city || null,
      deliveryAddress: this.model.deliveryAddress || null,
      secondaryAddresses: this.model.secondaryAddresses || null,
      communicationChannels: this.model.communicationChannels || null,
      identificationDocumentReference: this.model.identificationDocumentReference || null,
      dataProcessingConsent: this.model.dataProcessingConsent,
      dataProcessingConsentDateTime: this.model.dataProcessingConsentDateTime || null,
      dataProcessingConsentRevocationLog: this.model.dataProcessingConsentRevocationLog || null,
      additionalConsents: this.model.additionalConsents || null,
      therapyStatus: this.model.therapyStatus || null,
      prescribingSpecialist: this.model.prescribingSpecialist || null,
      referenceHospitalStructure: this.model.referenceHospitalStructure || null,
      referencePharmacy: this.model.referencePharmacy || null,
      preferredPickupPharmacy: this.model.preferredPickupPharmacy || null,
      deliveryMode: this.model.deliveryMode || null,
      reminderEnabled: this.model.reminderEnabled,
      caregiverFullName: this.model.caregiverFullName || null,
      caregiverPhone: this.model.caregiverPhone || null,
      caregiverRelationship: this.model.caregiverRelationship || null,
      otpRecipient: this.model['otpRecipient'] || null,
      preferredContact: this.model.preferredContact || null,
      structureId: this.model.structureId ? Number(this.model.structureId) : null
    };
  }

  private createEmptyModel(): PatientFormModel {
    return {
      assistedId: '',
      firstName: '',
      lastName: '',
      fiscalCode: '',
      email: '',
      primaryPhone: '',
      secondaryPhone: '',
      region: '',
      province: '',
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

  private markPhoneFieldsTouched(): void {
    for (const field of this.activeFields) {
      if (this.isPhoneField(field)) {
        this.phoneFieldTouched[field.key] = true;
      }
    }
  }

  consentOtpState: ConsentOtpState = this.createConsentOtpState();

  private createConsentOtpState(): ConsentOtpState {
    return {
      pending: false,
      sent: false,
      verified: false,
      destination: '',
      statusKey: null
    };
  }

  hasConsentPrimaryPhone(): boolean {
    const phone = this.getConsentPrimaryPhone();
    return typeof phone === 'string' && phone.trim().length > 0;
  }

  private getConsentPrimaryPhone(): string {
    if (this.model.otpRecipient === 'caregiverPhone') {
      return this.model.caregiverPhone || '';
    }
    return this.model.primaryPhone || '';
  }

  sendConsentOtp(): void {
    const phone = this.getConsentPrimaryPhone();
    if (!phone) {
      this.showMessage(this.t('patients.privacy.otp.error.phoneRequired'), 'error');
      return;
    }

    this.consentOtpState = { ...this.consentOtpState, pending: true, statusKey: 'patients.privacy.otp.status.sending' };
    // mark consent as pending
    this.model.dataProcessingConsent = true;
    this.model.dataProcessingConsentDateTime = '';

    this.subscriptions.add(
      this.http.post<any>(`${environment.apiBaseUrl}/users/otp/send`, { phoneNumber: phone, channel: 'sms' }).subscribe({
        next: (result) => {
          this.consentOtpState = {
            pending: false,
            sent: true,
            verified: false,
            destination: result?.destination ?? phone,
            statusKey: 'patients.privacy.otp.status.sent'
          };
          this.showMessage(this.t('patients.privacy.otp.success.sent'), 'success');
        },
        error: () => {
          this.consentOtpState = { pending: false, sent: false, verified: false, destination: '', statusKey: 'patients.privacy.otp.error.send' };
          this.showMessage(this.t('patients.privacy.otp.error.send'), 'error');
        }
      })
    );
  }

  verifyConsentOtp(): void {
    const phone = this.getConsentPrimaryPhone();
    const code = String(this.model.patientConsentOtpCode ?? '').trim();
    if (!phone) {
      this.showMessage(this.t('patients.privacy.otp.error.phoneRequired'), 'error');
      return;
    }
    if (!code) {
      this.showMessage(this.t('patients.privacy.otp.error.codeRequired'), 'error');
      return;
    }

    this.consentOtpState = { ...this.consentOtpState, pending: true, statusKey: 'patients.privacy.otp.status.verifying' };

    this.subscriptions.add(
      this.http.post<any>(`${environment.apiBaseUrl}/users/otp/check`, { phoneNumber: phone, code, channel: 'sms' }).subscribe({
        next: (result) => {
          if (!result || !result.approved) {
            this.consentOtpState = { pending: false, sent: true, verified: false, destination: result?.destination ?? phone, statusKey: 'patients.privacy.otp.error.rejected' };
            this.model.dataProcessingConsentDateTime = '';
            this.showMessage(this.t('patients.privacy.otp.error.rejected'), 'error');
            return;
          }

          this.model.dataProcessingConsent = true;
          this.model.dataProcessingConsentDateTime = this.getCurrentDateTimeLocalInputValue();
          this.consentOtpState = { pending: false, sent: true, verified: true, destination: result.destination, statusKey: 'patients.privacy.otp.status.verified' };
          this.showMessage(this.t('patients.privacy.otp.success.verified'), 'success');
        },
        error: () => {
          this.consentOtpState = { ...this.consentOtpState, pending: false, statusKey: 'patients.privacy.otp.error.check' };
          this.showMessage(this.t('patients.privacy.otp.error.check'), 'error');
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

  private showMessage(message: string, type: 'success' | 'error' = 'success', persistent = false): void {
    this.clearMessageTimer();
    this.messageType = type;
    this.message = message;

    if (persistent || !message) {
      return;
    }

    const activeMessage = message;
    this.messageTimeoutId = window.setTimeout(() => {
      if (this.message === activeMessage) {
        this.clearMessage();
      }
    }, AUTO_DISMISS_DELAY_MS);
  }

  private clearMessage(): void {
    this.clearMessageTimer();
    this.message = '';
  }

  private clearMessageTimer(): void {
    if (this.messageTimeoutId !== null) {
      window.clearTimeout(this.messageTimeoutId);
      this.messageTimeoutId = null;
    }
  }
}