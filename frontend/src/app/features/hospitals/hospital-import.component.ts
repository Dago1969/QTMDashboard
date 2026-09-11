import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';

@Component({
  selector: 'app-hospital-import',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card dashboard-content-card asl-management-shell csv-upload-shell">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('hospital.import.title') }}</h2>
          <p>{{ t('hospital.import.subtitle') }}</p>
        </div>
        <div class="asl-header-actions">
          <a class="btn btn-outline" routerLink="/dashboard/hospitals">{{ t('hospital.import.back') }}</a>
        </div>
      </div>

      <p class="dashboard-selection-info csv-upload-info">{{ t('hospital.import.hint') }}</p>

      <section class="asl-filters-panel csv-upload-panel">
        <label class="csv-upload-label" for="hospitalCsvFile">{{ t('hospital.import.fileLabel') }}</label>
        <input id="hospitalCsvFile" class="csv-upload-input" type="file" accept=".csv" (change)="onFileSelected($event)" />
        <div class="csv-upload-selected">
          <strong>{{ t('hospital.import.selectedFile') }}</strong>
          <span>{{ selectedFile?.name || t('hospital.import.noFileSelected') }}</span>
        </div>
        <div class="csv-upload-actions">
          <button class="btn btn-primary" type="button" (click)="upload()" [disabled]="!selectedFile || uploading">
            {{ uploading ? t('hospital.import.uploading') : t('hospital.import.upload') }}
          </button>
        </div>
      </section>

      <div *ngIf="message" class="alert" [class.alert-success]="messageType === 'success'" [class.alert-danger]="messageType === 'error'">
        {{ message }}
      </div>
    </div>
  `
})
export class HospitalImportComponent {
  selectedFile: File | null = null;
  uploading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';
  translations: Record<string, string> = {};

  constructor(
    private readonly http: HttpClient,
    private readonly i18n: I18nPropertiesService
  ) {
    this.i18n.loadTranslations(navigator.language).subscribe((translations) => {
      this.translations = translations;
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  upload(): void {
    if (!this.selectedFile || this.uploading) {
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    this.uploading = true;

    this.http.post(`${environment.ticketApiBaseUrl}/hospitals/import`, formData).subscribe({
      next: () => {
        this.message = this.t('hospital.import.success');
        this.messageType = 'success';
        this.selectedFile = null;
        this.uploading = false;
      },
      error: (error) => {
        this.message = (error?.error && typeof error.error === 'string') ? error.error : this.t('hospital.import.error');
        this.messageType = 'error';
        this.uploading = false;
      }
    });
  }
}