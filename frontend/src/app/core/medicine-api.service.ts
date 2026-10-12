import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface MedicineDto {
  id?: number;
  codiceAic: string;
  codFarmaco: string;
  codConfezione: string;
  denominazione: string;
  descrizione?: string;
  codiceDitta?: string;
  ragioneSociale?: string;
  statoAmministrativo?: string;
  tipoProcedura?: string;
  forma?: string;
  codiceAtc?: string;
  paAssociati?: string;
  fornitura?: string;
  linkFi?: string;
  linkRcp?: string;
  visibleForTenants?: boolean;
}

export interface MedicinePage {
  content: MedicineDto[];
  number: number;
  totalPages: number;
  totalElements: number;
}

export interface MedicineImportResult {
  importedRows: number;
  skippedRows: number;
}

export interface MedicineSearchFilters {
  codiceAic?: string;
  codFarmaco?: string;
  codConfezione?: string;
  denominazione?: string;
  descrizione?: string;
  codiceAtc?: string;
  ragioneSociale?: string;
  statoAmministrativo?: string;
}

/**
 * Service frontend per chiamare gli endpoint REST farmaci esposti da QTMDB.
 */
@Injectable({ providedIn: 'root' })
export class MedicineApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/medicines`;

  constructor(private readonly http: HttpClient) {}

  searchMedicines(filters?: MedicineSearchFilters): Observable<MedicineDto[]> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters ?? {})) {
      if (!value) {
        continue;
      }
      params = params.set(key, value);
    }

    return this.http.get<MedicineDto[]>(this.baseUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getMedicine(id: number): Observable<MedicineDto> {
    return this.http.get<MedicineDto>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createMedicine(medicine: MedicineDto): Observable<MedicineDto> {
    return this.http.post<MedicineDto>(this.baseUrl, medicine).pipe(
      catchError(this.handleError)
    );
  }

  updateMedicine(id: number, medicine: MedicineDto): Observable<MedicineDto> {
    return this.http.put<MedicineDto>(`${this.baseUrl}/${id}`, medicine).pipe(
      catchError(this.handleError)
    );
  }

  deleteMedicine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  importAifaCatalog(): Observable<MedicineImportResult> {
    return this.http.post<MedicineImportResult>(`${this.baseUrl}/import/aifa`, {});
  }

  searchAssociations(filters: MedicineSearchFilters, page: number): Observable<MedicinePage> {
    let params = new HttpParams().set('page', page).set('size', 50);
    for (const [key, value] of Object.entries(filters)) {
      if (value?.trim()) {
        params = params.set(key, value.trim());
      }
    }
    return this.http.get<MedicinePage>(`${this.baseUrl}/associations`, { params });
  }

  updateTenantVisibility(id: number, visibleForTenants: boolean): Observable<MedicineDto> {
    return this.http.put<MedicineDto>(`${this.baseUrl}/${id}/tenant-visibility`, { visibleForTenants });
  }

  private handleError(error: unknown) {
    return throwError(() => error);
  }
}