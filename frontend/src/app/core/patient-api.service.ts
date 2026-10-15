import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// DTO paziente condiviso con il backend QTMDB.
export interface PatientDto {
  id?: number;
  assistedId?: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: string;
  fiscalCode: string;
  email?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  regionId?: number;
  region?: string;
  provinceId?: number;
  province?: string;
  cityId?: number;
  city?: string;
  deliveryAddress?: string;
  secondaryAddresses?: string;
  communicationChannels?: string;
  identificationDocumentReference?: string;
  dataProcessingConsent?: boolean;
  dataProcessingConsentDateTime?: string;
  consentRevoked?: boolean;
  dataProcessingConsentRevocationLog?: string;
  additionalConsents?: string;
  therapyStatus?: string;
  prescribingSpecialist?: string;
  referenceHospitalStructure?: string;
  referencePharmacy?: string;
  preferredPickupPharmacy?: string;
  deliveryMode?: string;
  reminderEnabled?: boolean;
  caregiverFullName?: string;
  caregiverPhone?: string;
  caregiverRelationship?: string;
  otpRecipient?: string;
  preferredContact?: string;
  structureId?: number;
}

/**
 * Service per chiamare i servizi REST pazienti gestiti direttamente da QTMDB.
 */
@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/patients`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Ricerca pazienti con filtri opzionali.
   */
  searchPatients(params?: Partial<PatientDto>): Observable<PatientDto[]> {
    return this.http.get<PatientDto[]>(this.baseUrl, { params: params as any }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Recupera un paziente per ID.
   */
  getPatient(id: number): Observable<PatientDto> {
    return this.http.get<PatientDto>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Crea un nuovo paziente.
   */
  createPatient(patient: PatientDto): Observable<PatientDto> {
    return this.http.post<PatientDto>(this.baseUrl, patient).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Aggiorna un paziente esistente.
   */
  updatePatient(id: number, patient: PatientDto): Observable<PatientDto> {
    return this.http.put<PatientDto>(`${this.baseUrl}/${id}`, patient).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Elimina un paziente per ID.
   */
  deletePatient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Gestione centralizzata degli errori HTTP.
   */
  private handleError(error: unknown) {
    return throwError(() => error);
  }
}
