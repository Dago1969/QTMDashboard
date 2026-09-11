import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';

interface StructureDepartment {
  id: number;
  codiceStruttura?: string;
  codiceDisciplina?: string;
  indirizzo?: string;
}

@Component({
  selector: 'app-structure-departments-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card dashboard-content-card">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t('structureDepartments.title') }}</h2>
          <p>{{ t('structureDepartments.subtitle') }}</p>
        </div>
      </div>

      <section class="search-filters-panel">
        <label class="asl-filter-field">
          <span class="asl-filter-label">{{ t('structureDepartments.filter.structureCode') }}</span>
          <input class="asl-filter-input" [(ngModel)]="codiceStruttura" />
        </label>
        <div class="asl-filter-actions">
          <button class="btn btn-primary" type="button" (click)="load()">{{ t('crud.actions.load') }}</button>
        </div>
      </section>

      <section class="modern-table asl-table-panel">
        <div *ngIf="message" class="alert" [class.alert-success]="messageType === 'success'" [class.alert-danger]="messageType === 'error'">{{ message }}</div>

        <div class="table-responsive asl-table-wrapper">
          <table class="search-table asl-search-table">
            <thead>
              <tr>
                <th>{{ t('structureDepartments.column.code') }}</th>
                <th>{{ t('structureDepartments.column.departmentCode') }}</th>
                <th>{{ t('structureDepartments.column.address') }}</th>
                <th class="asl-actions-column">{{ t('search.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of records; trackBy: trackById">
                <td>{{ row.codiceStruttura }}</td>
                <td>{{ row.codiceDisciplina }}</td>
                <td>{{ row.indirizzo || '-' }}</td>
                <td class="asl-actions-cell">
                  <button class="btn btn-outline btn-sm" type="button" (click)="remove(row)">{{ t('crud.actions.remove') }}</button>
                </td>
              </tr>
              <tr *ngIf="records.length === 0">
                <td class="asl-empty-cell" colspan="4">{{ t('search.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr />

        <div class="assoc-form">
          <h3>{{ t('structureDepartments.add.title') }}</h3>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.departmentCode') }}</span>
            <input class="asl-filter-input" [(ngModel)]="newCodiceDisciplina" />
          </label>
          <label class="asl-filter-field">
            <span class="asl-filter-label">{{ t('structureDepartments.filter.address') }}</span>
            <input class="asl-filter-input" [(ngModel)]="newIndirizzo" />
          </label>
          <div class="asl-filter-actions">
            <button class="btn btn-primary" type="button" (click)="add()">{{ t('crud.actions.add') }}</button>
          </div>
        </div>
      </section>
    </div>
  `
})
export class StructureDepartmentsManagementComponent {
  codiceStruttura = '';
  records: StructureDepartment[] = [];
  newCodiceDisciplina = '';
  newIndirizzo = '';
  translations: Record<string, string> = {};
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(private readonly http: HttpClient, private readonly i18n: I18nPropertiesService) {
    this.i18n.loadTranslations(navigator.language).subscribe((t) => (this.translations = t));
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  load(): void {
    if (!this.codiceStruttura) {
      this.showMessage('structureDepartments.messages.requireStructure', 'error');
      return;
    }
    this.http
      .get<StructureDepartment[]>(`${environment.ticketApiBaseUrl}/structure-departments`, { params: { codiceStruttura: this.codiceStruttura } })
      .subscribe({
        next: (data) => {
          this.records = data;
          this.showMessage('', 'success');
        },
        error: () => this.showMessage('structureDepartments.messages.loadError', 'error')
      });
  }

  add(): void {
    if (!this.codiceStruttura || !this.newCodiceDisciplina) {
      this.showMessage('structureDepartments.messages.requireFields', 'error');
      return;
    }
    const payload = { codiceStruttura: this.codiceStruttura, codiceDisciplina: this.newCodiceDisciplina, indirizzo: this.newIndirizzo };
    this.http.post(`${environment.ticketApiBaseUrl}/structure-departments`, payload).subscribe({
      next: () => {
        this.showMessage('structureDepartments.messages.addSuccess', 'success');
        this.load();
        this.newCodiceDisciplina = '';
        this.newIndirizzo = '';
      },
      error: () => this.showMessage('structureDepartments.messages.addError', 'error')
    });
  }

  remove(row: StructureDepartment): void {
    if (!row.codiceStruttura || !row.codiceDisciplina) {
      return;
    }
    this.http
      .delete(`${environment.ticketApiBaseUrl}/structure-departments`, { params: { codiceStruttura: row.codiceStruttura, codiceDisciplina: row.codiceDisciplina } })
      .subscribe({
        next: () => {
          this.showMessage('structureDepartments.messages.removeSuccess', 'success');
          this.load();
        },
        error: () => this.showMessage('structureDepartments.messages.removeError', 'error')
      });
  }

  trackById(_: number, item: StructureDepartment): number {
    return item.id;
  }

  private showMessage(key: string, type: 'success' | 'error'): void {
    this.message = key ? this.t(key) : '';
    this.messageType = type;
    if (key) {
      window.setTimeout(() => (this.message = ''), 5000);
    }
  }
}
