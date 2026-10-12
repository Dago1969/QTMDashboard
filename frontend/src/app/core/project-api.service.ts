import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProjectDto {
  id?: number;
  code: string;
  tenantId?: number;
  tenant?: string;
  clientCode?: string;
  descrizione?: string;
  logo?: string;
  footer?: string;
  emailSender?: string;
  dataInizio?: string;
  dataFine?: string;
  administrators?: ProjectAdministratorDto[];
  jsonVisit?: string;
  jsonSurvey?: string;
}

export interface ProjectAdministratorDto {
  userId: number;
  roleId: string;
  username?: string;
  email?: string;
}

export interface ProjectSearchFilters {
  code?: string;
  tenant?: string;
}

/**
 * Service frontend per chiamare gli endpoint REST dei progetti centralizzati di QTMDashboard.
 */
@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  constructor(private readonly http: HttpClient) {}

  searchProjects(filters?: ProjectSearchFilters): Observable<ProjectDto[]> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters ?? {})) {
      if (!value) {
        continue;
      }
      params = params.set(key, value);
    }

    return this.http.get<ProjectDto[]>(this.baseUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getProject(id: number): Observable<ProjectDto> {
    return this.http.get<ProjectDto>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createProject(project: ProjectDto): Observable<ProjectDto> {
    return this.http.post<ProjectDto>(this.baseUrl, project).pipe(
      catchError(this.handleError)
    );
  }

  updateProject(id: number, project: ProjectDto): Observable<ProjectDto> {
    return this.http.put<ProjectDto>(`${this.baseUrl}/${id}`, project).pipe(
      catchError(this.handleError)
    );
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: unknown) {
    return throwError(() => error);
  }
}