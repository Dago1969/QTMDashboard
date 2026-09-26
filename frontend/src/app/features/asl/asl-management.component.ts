import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import {
  SearchFilterField,
  SearchPageActionEvent,
  SearchPageComponent,
  SearchResultColumn
} from '../../shared/search-page.component';

interface AslRecord {
  id: number;
  codiceAzienda?: string;
  denominazioneAzienda?: string;
  codiceRegione?: string;
  regioneDescrizione?: string;
  provinciaDescrizione?: string;
  anno?: number;
  indirizzo?: string;
  email?: string;
  telefono?: string;
  imported: boolean;
}

interface Referent {
  id?: number;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  email: string;
  note: string;
}

@Component({
  selector: 'app-asl-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchPageComponent],
  template: `
    <app-search-page
      [titleKey]="'dashboard.menu.asl'"
      [subtitleKey]="'asl.management.subtitle'"
      [emptyStateKey]="'search.noResults'"
      [filters]="filters"
      [columns]="columns"
      [fetchResults]="fetchResults"
      [showCreateAction]="false"
      (actionColumn)="onAction($event)"
    />

    <div *ngIf="referentsAsl" class="asl-modal-backdrop" (click)="closeReferents()">
      <section class="asl-referents-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="qtm-modal-header asl-referents-header">
          <div class="qtm-modal-header-top">
            <h3 class="qtm-modal-title">{{ t('asl.referents.title') }}</h3>
            <button class="qtm-modal-close" type="button" (click)="closeReferents()" [attr.aria-label]="t('asl.referents.close')">
              <span class="qtm-modal-close-circle" aria-hidden="true"><span class="qtm-modal-close-icon"></span></span>
            </button>
          </div>
        </header>
        <div class="asl-referents-subheader"><strong>{{ referentsAsl.denominazioneAzienda || referentsAsl.codiceAzienda }}</strong></div>
        <div class="asl-referents-content">
          <div class="asl-referents-list">
            <h4>{{ t('asl.referents.current') }} ({{ referents.length }})</h4>
            <p *ngIf="referents.length === 0" class="asl-referents-empty">{{ t('asl.referents.empty') }}</p>
            <article *ngFor="let referent of referents" class="asl-referent-card" [class.asl-referent-card-editing]="editingReferentId === referent.id">
              <div class="asl-referent-details">
                <strong class="asl-referent-name">{{ referent.firstName }} {{ referent.lastName }}</strong>
                <span class="asl-referent-role">{{ referent.role || '-' }}</span>
                <span class="asl-referent-contact">{{ referent.email || '-' }} · {{ referent.phone || '-' }}</span>
                <small *ngIf="referent.note" class="asl-referent-note-text">{{ referent.note }}</small>
              </div>
              <div class="asl-referent-actions">
                <button class="btn btn-outline btn-sm" type="button" (click)="editReferent(referent)" [disabled]="referentsBusy">
                  {{ t('asl.referents.edit') }}
                </button>
                <button class="btn btn-outline-danger btn-sm asl-referent-remove" type="button" (click)="removeReferent(referent)" [disabled]="referentsBusy">
                  {{ t('asl.referents.remove') }}
                </button>
              </div>
            </article>
          </div>
          <form class="asl-referent-form asl-tenapp-form" (ngSubmit)="saveReferent()">
            <h4>{{ editingReferentId !== null ? t('asl.referents.editTitle') + ' (' + newReferent.firstName + ' ' + newReferent.lastName + ')' : t('asl.referents.add') }}</h4>
            <div class="asl-referent-form-grid">
              <label class="asl-tenapp-field"><span>{{ t('asl.referents.firstName') }}</span><input class="asl-filter-input" type="text" name="firstName" [(ngModel)]="newReferent.firstName" required /></label>
              <label class="asl-tenapp-field"><span>{{ t('asl.referents.lastName') }}</span><input class="asl-filter-input" type="text" name="lastName" [(ngModel)]="newReferent.lastName" required /></label>
              <label class="asl-tenapp-field"><span>{{ t('asl.referents.role') }}</span><input class="asl-filter-input" type="text" name="role" [(ngModel)]="newReferent.role" /></label>
              <label class="asl-tenapp-field"><span>{{ t('asl.referents.phone') }}</span><input class="asl-filter-input" type="tel" name="phone" [(ngModel)]="newReferent.phone" /></label>
              <label class="asl-referent-field-wide asl-tenapp-field"><span>{{ t('asl.referents.email') }}</span><input class="asl-filter-input" type="email" name="email" [(ngModel)]="newReferent.email" /></label>
              <label class="asl-referent-note asl-tenapp-field"><span>{{ t('asl.referents.note') }}</span><textarea class="asl-filter-input" name="note" [(ngModel)]="newReferent.note" rows="3"></textarea></label>
            </div>
            <div class="asl-referent-form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="referentsBusy">
                {{ editingReferentId !== null ? t('asl.referents.updateAction') : t('asl.referents.addAction') }}
              </button>
              <button *ngIf="editingReferentId !== null" class="btn btn-outline" type="button" (click)="cancelEdit()" [disabled]="referentsBusy">
                {{ t('asl.referents.cancelEdit') }}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `
})
export class AslManagementComponent implements OnInit {
  @ViewChild(SearchPageComponent) private searchPage?: SearchPageComponent<AslRecord>;

  readonly filters: SearchFilterField[] = [
    { key: 'id', labelKey: 'asl.filter.id', type: 'number' },
    { key: 'code', labelKey: 'asl.filter.code', type: 'text' },
    { key: 'name', labelKey: 'asl.filter.name', type: 'text' },
    { key: 'regionCode', labelKey: 'patients.field.region', type: 'text' },
    { key: 'provinceId', labelKey: 'patients.field.province', type: 'text' },
    { key: 'imported', labelKey: 'hospital.filter.imported', type: 'select', options: [
      { value: 'all', labelKey: 'hospital.filter.status.all' },
      { value: 'imported', labelKey: 'hospital.filter.status.imported' },
      { value: 'notImported', labelKey: 'hospital.filter.status.notImported' }
    ] }
  ];

  readonly columns: SearchResultColumn<AslRecord>[] = [
    { key: 'codiceAzienda', labelKey: 'asl.column.code' },
    { key: 'denominazioneAzienda', labelKey: 'asl.column.name' },
    { key: 'regioneDescrizione', labelKey: 'asl.column.regionDescription', formatter: (row) => row.regioneDescrizione || row.codiceRegione || '-' },
    { key: 'provinciaDescrizione', labelKey: 'asl.column.provinceDescription' },
    { key: 'anno', labelKey: 'asl.column.year' },
    { key: 'indirizzo', labelKey: 'asl.column.address' },
    { key: 'email', labelKey: 'asl.column.email' },
    { key: 'telefono', labelKey: 'asl.column.phone' },
    { key: 'action', labelKey: 'search.actions', formatter: (row) => row.imported ? 'Disassocia' : 'Associa', action: (row) => row.imported ? 'secondary' : 'primary' },
    { key: 'referents', labelKey: 'asl.action.manageReferents', formatter: () => 'Referenti', action: () => 'secondary', visible: (row) => row.imported }
  ];

  referentsAsl: AslRecord | null = null;
  referents: Referent[] = [];
  referentsBusy = false;
  translations: Record<string, string> = {};
  newReferent: Referent = this.emptyReferent();
  editingReferentId: number | null = null;

  readonly fetchResults = (filters: Record<string, string>): Observable<AslRecord[]> =>
    this.http.get<AslRecord[]>(`${environment.apiBaseUrl}/asl/overview`, { params: filters }).pipe(
      map((records) => records.filter((row) => this.matchesFilters(row, filters)))
    );

  constructor(private readonly http: HttpClient, private readonly i18nPropertiesService: I18nPropertiesService) {}

  ngOnInit(): void {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe((translations) => {
      this.translations = translations;
    });
  }

  onAction(event: { column: SearchResultColumn<AslRecord>; event: SearchPageActionEvent<AslRecord> }): void {
    const row = event.event.row;
    if (event.column.key === 'referents') {
      this.openReferents(row);
      return;
    }
    const request = row.imported
      ? this.http.delete(`${environment.apiBaseUrl}/asl/${row.id}`)
      : this.http.post(`${environment.apiBaseUrl}/asl/import`, { sourceIds: [row.id] });
    request.subscribe(() => this.searchPage?.reload(false));
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  openReferents(asl: AslRecord): void {
    this.referentsAsl = asl;
    this.referentsBusy = true;
    this.http.get<Referent[]>(`${environment.apiBaseUrl}/asl/${asl.id}/referents`).subscribe({
      next: (referents) => {
        this.referents = referents;
        this.referentsBusy = false;
      },
      error: () => {
        this.referents = [];
        this.referentsBusy = false;
      }
    });
  }

  closeReferents(): void {
    this.referentsAsl = null;
    this.referents = [];
    this.cancelEdit();
  }

  editReferent(referent: Referent): void {
    if (referent.id === undefined) {
      return;
    }
    this.editingReferentId = referent.id;
    this.newReferent = { ...referent };
  }

  cancelEdit(): void {
    this.editingReferentId = null;
    this.newReferent = this.emptyReferent();
  }

  saveReferent(): void {
    if (!this.referentsAsl) {
      return;
    }
    this.referentsBusy = true;
    const request = this.editingReferentId === null
      ? this.http.post<Referent[]>(`${environment.apiBaseUrl}/asl/${this.referentsAsl.id}/referents`, this.newReferent)
      : this.http.put<Referent[]>(`${environment.apiBaseUrl}/asl/${this.referentsAsl.id}/referents/${this.editingReferentId}`, {
        ...this.newReferent,
        id: this.editingReferentId
      });
    request.subscribe({
      next: (referents) => {
        this.referents = referents;
        this.cancelEdit();
        this.referentsBusy = false;
      },
      error: () => {
        this.referentsBusy = false;
      }
    });
  }

  removeReferent(referent: Referent): void {
    if (!this.referentsAsl || referent.id === undefined) {
      return;
    }
    this.referentsBusy = true;
    this.http.delete(`${environment.apiBaseUrl}/asl/${this.referentsAsl.id}/referents/${referent.id}`).subscribe({
      next: () => {
        this.referents = this.referents.filter((item) => item.id !== referent.id);
        this.referentsBusy = false;
      },
      error: () => {
        this.referentsBusy = false;
      }
    });
  }

  private emptyReferent(): Referent {
    return { firstName: '', lastName: '', role: '', phone: '', email: '', note: '' };
  }

  private matchesFilters(row: AslRecord, filters: Record<string, string>): boolean {
    return (!filters['id'] || row.id === Number(filters['id']))
      && (!filters['code'] || (row.codiceAzienda || '').toLowerCase().includes(filters['code'].toLowerCase()))
      && (!filters['name'] || (row.denominazioneAzienda || '').toLowerCase().includes(filters['name'].toLowerCase()))
      && (!filters['imported'] || filters['imported'] === 'all' || (filters['imported'] === 'imported' ? row.imported : !row.imported));
  }
}
