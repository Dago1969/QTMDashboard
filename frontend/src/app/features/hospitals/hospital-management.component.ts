import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { SearchFilterChangeEvent, SearchFilterField, SearchPageActionEvent, SearchPageComponent, SearchResultColumn } from '../../shared/search-page.component';

interface HospitalRecord {
  id: number;
  anno?: number;
  codiceRegione?: string;
  regione?: string;
  codiceAsl?: string;
  asl?: string;
  codiceStruttura?: string;
  struttura?: string;
  comune?: string;
  siglaProvincia?: string;
  tipoStruttura?: string;
  imported: boolean;
}

interface RegionOption {
  code?: string;
  regionCode?: string;
  name?: string;
}

interface AslOption {
  codiceAzienda?: string;
  denominazioneAzienda?: string;
  codiceRegione?: string;
  imported?: boolean;
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
  selector: 'app-hospital-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchPageComponent],
  template: `
    <app-search-page
      [titleKey]="'dashboard.menu.hospital'"
      [subtitleKey]="'hospital.management.subtitle'"
      [emptyStateKey]="'search.noResults'"
      [filters]="filters"
      [columns]="columns"
      [fetchResults]="fetchResults"
      [hideFilterActions]="true"
      [hideRowId]="true"
      [filtersClass]="'hospitals-filters-four-columns'"
      [showCreateAction]="false"
      (actionColumn)="onAction($event)"
      (filterChanged)="onFilterChanged($event)"
    />

    <div *ngIf="referentsHospital" class="asl-modal-backdrop" (click)="closeReferents()">
      <section class="asl-referents-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="qtm-modal-header asl-referents-header">
          <div class="qtm-modal-header-top">
            <h3 class="qtm-modal-title">{{ t('referents.title') }}</h3>
            <button class="qtm-modal-close" type="button" (click)="closeReferents()" [attr.aria-label]="t('referents.close')">
              <span class="qtm-modal-close-circle" aria-hidden="true"><span class="qtm-modal-close-icon"></span></span>
            </button>
          </div>
        </header>
        <div class="asl-referents-subheader"><strong>{{ referentsHospital.struttura || referentsHospital.codiceStruttura }}</strong></div>
        <div class="asl-referents-content">
          <div class="asl-referents-list">
            <h4>{{ t('referents.current') }} ({{ referents.length }})</h4>
            <p *ngIf="referents.length === 0" class="asl-referents-empty">{{ t('referents.empty') }}</p>
            <article *ngFor="let referent of referents" class="asl-referent-card" [class.asl-referent-card-editing]="editingReferentId === referent.id">
              <div class="asl-referent-details">
                <strong class="asl-referent-name">{{ referent.firstName }} {{ referent.lastName }}</strong>
                <span class="asl-referent-role">{{ referent.role || '-' }}</span>
                <span class="asl-referent-contact">{{ referent.email || '-' }} · {{ referent.phone || '-' }}</span>
                <small *ngIf="referent.note" class="asl-referent-note-text">{{ referent.note }}</small>
              </div>
              <div class="asl-referent-actions">
                <button class="btn btn-outline btn-sm" type="button" (click)="editReferent(referent)" [disabled]="referentsBusy">{{ t('referents.edit') }}</button>
                <button class="btn btn-outline-danger btn-sm asl-referent-remove" type="button" (click)="removeReferent(referent)" [disabled]="referentsBusy">{{ t('referents.remove') }}</button>
              </div>
            </article>
          </div>
          <form class="asl-referent-form asl-tenapp-form" (ngSubmit)="saveReferent()">
            <h4>{{ editingReferentId !== null ? t('referents.editTitle') : t('referents.add') }}</h4>
            <div class="asl-referent-form-grid">
              <label class="asl-tenapp-field"><span>{{ t('referents.firstName') }}</span><input class="asl-filter-input" type="text" name="firstName" [(ngModel)]="newReferent.firstName" required /></label>
              <label class="asl-tenapp-field"><span>{{ t('referents.lastName') }}</span><input class="asl-filter-input" type="text" name="lastName" [(ngModel)]="newReferent.lastName" required /></label>
              <label class="asl-tenapp-field"><span>{{ t('referents.role') }}</span><input class="asl-filter-input" type="text" name="role" [(ngModel)]="newReferent.role" /></label>
              <label class="asl-tenapp-field"><span>{{ t('referents.phone') }}</span><input class="asl-filter-input" type="tel" name="phone" [(ngModel)]="newReferent.phone" /></label>
              <label class="asl-referent-field-wide asl-tenapp-field"><span>{{ t('referents.email') }}</span><input class="asl-filter-input" type="email" name="email" [(ngModel)]="newReferent.email" /></label>
              <label class="asl-referent-note asl-tenapp-field"><span>{{ t('referents.note') }}</span><textarea class="asl-filter-input" name="note" [(ngModel)]="newReferent.note" rows="3"></textarea></label>
            </div>
            <div class="asl-referent-form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="referentsBusy">{{ editingReferentId !== null ? t('referents.updateAction') : t('referents.addAction') }}</button>
              <button *ngIf="editingReferentId !== null" class="btn btn-outline" type="button" (click)="cancelEdit()" [disabled]="referentsBusy">{{ t('referents.cancelEdit') }}</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `
})
export class HospitalManagementComponent implements OnInit {
  @ViewChild(SearchPageComponent) private searchPage?: SearchPageComponent<HospitalRecord>;

  readonly filters: SearchFilterField[] = [
    { key: 'regionCode', labelKey: 'patients.field.region', type: 'select', options: [], emptyOptionLabelKey: 'hospital.filter.status.all' },
    { key: 'aslCode', labelKey: 'hospital.filter.aslCode', type: 'select', options: [], emptyOptionLabelKey: 'hospital.filter.status.all' },
    { key: 'imported', labelKey: 'hospital.filter.imported', type: 'select', options: [
      { value: 'imported', labelKey: 'hospital.filter.status.imported' },
      { value: 'notImported', labelKey: 'hospital.filter.status.notImported' }
    ], emptyOptionLabelKey: 'hospital.filter.status.all' },
    { key: 'name', labelKey: 'hospital.filter.name', type: 'text' }
  ];

  readonly columns: SearchResultColumn<HospitalRecord>[] = [
    { key: 'regione', labelKey: 'hospital.column.region', formatter: (row) => row.regione ? `${row.regione} (${row.codiceRegione || ''})` : row.codiceRegione || '-' },
    { key: 'asl', labelKey: 'hospital.column.asl', formatter: (row) => row.asl ? `${row.asl} (${row.codiceAsl || ''})` : row.codiceAsl || '-' },
    { key: 'codiceStruttura', labelKey: 'hospital.column.code' },
    { key: 'struttura', labelKey: 'hospital.column.name' },
    { key: 'comune', labelKey: 'hospital.column.municipality' },
    { key: 'tipoStruttura', labelKey: 'hospital.column.type' },
    { key: 'action', labelKey: 'search.actions', formatter: (row) => row.imported ? 'Disassocia' : 'Associa', action: (row) => row.imported ? 'secondary' : 'primary' },
    { key: 'referents', labelKey: 'asl.action.manageReferents', formatter: () => 'Referenti', action: () => 'secondary', visible: (row) => row.imported }
  ];

  referentsHospital: HospitalRecord | null = null;
  referents: Referent[] = [];
  referentsBusy = false;
  translations: Record<string, string> = {};
  newReferent: Referent = this.emptyReferent();
  editingReferentId: number | null = null;
  allAslList: AslOption[] = [];
  aslOptions: AslOption[] = [];

  readonly fetchResults = (filters: Record<string, string>): Observable<HospitalRecord[]> =>
    this.http.get<HospitalRecord[]>(`${environment.apiBaseUrl}/hospital/overview`, { params: filters }).pipe(
      map((records) => records.filter((row) => !filters['imported'] || filters['imported'] === 'all' || (filters['imported'] === 'imported' ? row.imported : !row.imported)))
    );

  constructor(private readonly http: HttpClient, private readonly i18n: I18nPropertiesService) {
    this.http.get<RegionOption[]>(`${environment.apiBaseUrl}/geography/regions`).subscribe((regions) => {
      const regionFilter = this.filters.find((filter) => filter.key === 'regionCode');
      if (regionFilter) {
        regionFilter.options = (regions ?? [])
          .filter((region) => (region.code || region.regionCode) && region.name)
          .map((region) => ({ value: region.code || region.regionCode!, label: region.name! }));
      }
    });

    this.http.get<AslOption[]>(`${environment.apiBaseUrl}/asl/overview`).subscribe((asls) => {
      const uniqueAsl = new Map<string, AslOption>();
      (asls ?? [])
        .filter((asl) => asl.imported && asl.codiceAzienda)
        .forEach((asl) => {
          const key = `${this.normalizeCode(asl.codiceRegione)}:${this.normalizeCode(asl.codiceAzienda)}`;
          if (!uniqueAsl.has(key)) {
            uniqueAsl.set(key, asl);
          }
        });
      this.allAslList = [...uniqueAsl.values()];
      this.updateAslOptions(null);
    });
  }

  ngOnInit(): void {
    this.i18n.loadTranslations(navigator.language).subscribe((translations) => this.translations = translations);
  }

  onFilterChanged(event: SearchFilterChangeEvent): void {
    if (event.key !== 'regionCode') return;
    this.onRegionChange(event.value || null);
  }

  onRegionChange(regionCode: string | null): void {
    this.searchPage?.setFilterValue('aslCode', null);
    this.updateAslOptions(regionCode);
  }

  private updateAslOptions(regionCode: string | null): void {
    const aslFilter = this.filters.find((filter) => filter.key === 'aslCode');
    if (!aslFilter) return;
    this.aslOptions = regionCode
      ? this.allAslList.filter((asl) => this.normalizeCode(asl.codiceRegione) === this.normalizeCode(regionCode))
      : [...this.allAslList];
    aslFilter.options = this.aslOptions.map((asl) => ({
      value: asl.codiceAzienda!,
      label: asl.denominazioneAzienda || asl.codiceAzienda!
    }));
  }

  private normalizeCode(value?: string | null): string {
    return (value ?? '').trim().replace(/^0+/, '') || '0';
  }

  onAction(event: { column: SearchResultColumn<HospitalRecord>; event: SearchPageActionEvent<HospitalRecord> }): void {
    const row = event.event.row;
    if (event.column.key === 'referents') {
      this.openReferents(row);
      return;
    }
    const request = row.imported
      ? this.http.delete(`${environment.apiBaseUrl}/hospital/${row.id}`)
      : this.http.post(`${environment.apiBaseUrl}/hospital/import`, { sourceIds: [row.id] });
    request.subscribe(() => this.searchPage?.reload(false));
  }

  t(key: string): string { return this.translations[key] ?? key; }

  openReferents(hospital: HospitalRecord): void {
    this.referentsHospital = hospital;
    this.referentsBusy = true;
    this.http.get<Referent[]>(`${environment.apiBaseUrl}/hospital/${hospital.id}/referents`).subscribe({
      next: (referents) => { this.referents = referents; this.referentsBusy = false; },
      error: () => { this.referents = []; this.referentsBusy = false; }
    });
  }

  closeReferents(): void { this.referentsHospital = null; this.referents = []; this.cancelEdit(); }

  editReferent(referent: Referent): void {
    if (referent.id === undefined) return;
    this.editingReferentId = referent.id;
    this.newReferent = { ...referent };
  }

  cancelEdit(): void { this.editingReferentId = null; this.newReferent = this.emptyReferent(); }

  saveReferent(): void {
    if (!this.referentsHospital) return;
    this.referentsBusy = true;
    const hospitalId = this.referentsHospital.id;
    const request = this.editingReferentId === null
      ? this.http.post<Referent[]>(`${environment.apiBaseUrl}/hospital/${hospitalId}/referents`, this.newReferent)
      : this.http.put<Referent[]>(`${environment.apiBaseUrl}/hospital/${hospitalId}/referents/${this.editingReferentId}`, { ...this.newReferent, id: this.editingReferentId });
    request.subscribe({
      next: (referents) => { this.referents = referents; this.cancelEdit(); this.referentsBusy = false; },
      error: () => { this.referentsBusy = false; }
    });
  }

  removeReferent(referent: Referent): void {
    if (!this.referentsHospital || referent.id === undefined) return;
    this.referentsBusy = true;
    this.http.delete(`${environment.apiBaseUrl}/hospital/${this.referentsHospital.id}/referents/${referent.id}`).subscribe({
      next: () => { this.referents = this.referents.filter((item) => item.id !== referent.id); this.referentsBusy = false; },
      error: () => { this.referentsBusy = false; }
    });
  }

  private emptyReferent(): Referent { return { firstName: '', lastName: '', role: '', phone: '', email: '', note: '' }; }
}
