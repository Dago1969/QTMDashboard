import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';

@Component({
  selector: 'app-asl-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card dashboard-content-card">
      <div class="dashboard-header">
        <h2>{{ t('asl.import.title') }}</h2>
      </div>

      <p>{{ t('asl.import.subtitle') }}</p>

      <div class="card" style="padding: 1rem; margin-bottom: 1rem;">
        <input type="file" (change)="onFileSelected($event)" accept=".csv" />
        <div style="margin-top:1rem">
          <button class="btn btn-primary" (click)="upload()" [disabled]="!selectedFile">{{ t('asl.import.upload') }}</button>
        </div>
      </div>

      <div *ngIf="message" class="alert" [class.alert-success]="messageType === 'success'" [class.alert-danger]="messageType === 'error'">
        {{ message }}
      </div>
    </div>
  `
})
export class AslImportComponent {
  selectedFile: File | null = null;
  message = '';
  messageType: 'success' | 'error' = 'success';
  translations: Record<string, string> = {};

  constructor(private readonly http: HttpClient, private readonly i18n: I18nPropertiesService) {
    this.i18n.loadTranslations(navigator.language).subscribe(t => this.translations = t);
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  upload(): void {
    if (!this.selectedFile) return;
    const form = new FormData();
    form.append('file', this.selectedFile);

    const url = `${environment.ticketApiBaseUrl}/asl/import`;

    this.http.post(url, form).subscribe({
      next: () => {
        this.message = this.t('asl.import.success');
        this.messageType = 'success';
        this.selectedFile = null;
      },
      error: (err) => {
        this.message = (err?.error && typeof err.error === 'string') ? err.error : this.t('asl.import.error');
        this.messageType = 'error';
      }
    });
  }
}
