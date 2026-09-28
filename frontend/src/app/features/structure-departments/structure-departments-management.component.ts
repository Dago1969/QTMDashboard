import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { SearchFilterField, SearchPageActionEvent, SearchPageComponent, SearchResultColumn } from '../../shared/search-page.component';

interface StructureDepartment {
  id: number;
  codiceRegione?: string;
  regione?: string;
  codiceAsl?: string;
  asl?: string;
  codiceStruttura?: string;
  struttura?: string;
  codiceDisciplina?: string;
  disciplina?: string;
  descrizioneDisciplina?: string;
  indirizzo?: string;
  imported: boolean;
}

interface FilterOption {
  code: string;
  label: string;
  regionCode?: string;
  aslCode?: string;
}

interface Referent {
  id?: number;
  firstName: string;
  lastName: string;
  role?: string;
  phone?: string;
  email?: string;
  note?: string;
}

@Component({
  selector: 'app-structure-departments-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchPageComponent],
  template: `
    <app-search-page
      [titleKey]="'structureDepartments.title'"
      [subtitleKey]="'structureDepartments.subtitle'"
      [emptyStateKey]="'structureDepartments.search.noResults'"
      [filters]="filters"
      [columns]="columns"
      [fetchResults]="fetchResults"
      [showCreateAction]="false"
      [hideFilterActions]="true"
      [filtersClass]="'structure-departments-filters-four-columns'"
      [hideRowId]="true"
      (filterChanged)="onFilterChanged($event)"
      (actionColumn)="onAction($event)"
    />
    <div *ngIf="referentsDepartment" class="asl-modal-backdrop" (click)="closeReferents()">
      <section class="asl-referents-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="qtm-modal-header asl-referents-header">
          <div class="qtm-modal-header-top">
            <h3 class="qtm-modal-title">{{ t('referents.title') }}</h3>
            <button class="qtm-modal-close" type="button" (click)="closeReferents()" [attr.aria-label]="t('referents.close')">
              <span class="qtm-modal-close-circle" aria-hidden="true"><span class="qtm-modal-close-icon"></span></span>
            </button>
          </div>
        </header>
        <div class="asl-referents-subheader"><strong>{{ referentsDepartment.disciplina || referentsDepartment.codiceDisciplina }}</strong></div>
        <div class="asl-referents-content">
          <div class="asl-referents-list">
            <h4>{{ t('referents.current') }} ({{ referents.length }})</h4>
            <p *ngIf="referents.length === 0" class="asl-referents-empty">{{ t('referents.empty') }}</p>
            <article *ngFor="let referent of referents" class="asl-referent-card">
              <div class="asl-referent-details"><strong class="asl-referent-name">{{ referent.firstName }} {{ referent.lastName }}</strong><span class="asl-referent-role">{{ referent.role || '-' }}</span><span class="asl-referent-contact">{{ referent.email || '-' }} · {{ referent.phone || '-' }}</span><small *ngIf="referent.note" class="asl-referent-note-text">{{ referent.note }}</small></div>
              <div class="asl-referent-actions"><button class="btn btn-outline btn-sm" type="button" (click)="editReferent(referent)" [disabled]="referentsBusy">{{ t('referents.edit') }}</button><button class="btn btn-outline-danger btn-sm" type="button" (click)="removeReferent(referent)" [disabled]="referentsBusy">{{ t('referents.remove') }}</button></div>
            </article>
          </div>
          <form class="asl-referent-form asl-tenapp-form" (ngSubmit)="saveReferent()">
            <h4>{{ editingReferentId !== null ? t('referents.editTitle') : t('referents.add') }}</h4>
            <div class="asl-referent-form-grid">
              <label class="asl-tenapp-field"><span>{{ t('referents.firstName') }}</span><input class="asl-filter-input" name="firstName" [(ngModel)]="newReferent.firstName" required /></label>
              <label class="asl-tenapp-field"><span>{{ t('referents.lastName') }}</span><input class="asl-filter-input" name="lastName" [(ngModel)]="newReferent.lastName" required /></label>
              <label class="asl-tenapp-field"><span>{{ t('referents.role') }}</span><input class="asl-filter-input" name="role" [(ngModel)]="newReferent.role" /></label>
              <label class="asl-tenapp-field"><span>{{ t('referents.phone') }}</span><input class="asl-filter-input" name="phone" [(ngModel)]="newReferent.phone" /></label>
              <label class="asl-referent-field-wide asl-tenapp-field"><span>{{ t('referents.email') }}</span><input class="asl-filter-input" name="email" [(ngModel)]="newReferent.email" /></label>
              <label class="asl-referent-note asl-tenapp-field"><span>{{ t('referents.note') }}</span><textarea class="asl-filter-input" name="note" [(ngModel)]="newReferent.note"></textarea></label>
            </div>
            <button class="btn btn-primary" type="submit" [disabled]="referentsBusy">{{ editingReferentId !== null ? t('referents.updateAction') : t('referents.addAction') }}</button>
          </form>
        </div>
      </section>
    </div>
  `
})
export class StructureDepartmentsManagementComponent implements OnInit {
  @ViewChild(SearchPageComponent) private searchPage?: SearchPageComponent<StructureDepartment>;

  readonly filters: SearchFilterField[] = [
    { key: 'regionCode', labelKey: 'structureDepartments.filter.regionCode', type: 'select', emptyOptionLabelKey: 'hospital.filter.status.all' },
    { key: 'aslCode', labelKey: 'structureDepartments.filter.aslCode', type: 'select', emptyOptionLabelKey: 'hospital.filter.status.all' },
    { key: 'structureCode', labelKey: 'structureDepartments.filter.hospital', type: 'select', emptyOptionLabelKey: 'hospital.filter.status.all' },
    { key: 'imported', labelKey: 'hospital.filter.imported', type: 'select', options: [
      { value: 'all', labelKey: 'hospital.filter.status.all' },
      { value: 'imported', labelKey: 'hospital.filter.status.imported' },
      { value: 'notImported', labelKey: 'hospital.filter.status.notImported' }
    ] }
  ];

  readonly columns: SearchResultColumn<StructureDepartment>[] = [
    { key: 'regione', labelKey: 'structureDepartments.column.region', formatter: (row) => row.regione ? `${row.regione} (${row.codiceRegione || ''})` : row.codiceRegione || '-' },
    { key: 'asl', labelKey: 'structureDepartments.column.asl', formatter: (row) => row.asl ? `${row.asl} (${row.codiceAsl || ''})` : row.codiceAsl || '-' },
    { key: 'struttura', labelKey: 'structureDepartments.column.hospital', formatter: (row) => row.struttura ? `${row.struttura} (${row.codiceStruttura || ''})` : row.codiceStruttura || '-' },
    { key: 'codiceStruttura', labelKey: 'structureDepartments.column.code' },
    { key: 'disciplina', labelKey: 'structureDepartments.column.department', formatter: (row) => row.descrizioneDisciplina || row.disciplina || row.codiceDisciplina || '-' },
    { key: 'indirizzo', labelKey: 'structureDepartments.column.address' },
    { key: 'action', labelKey: 'search.actions', formatter: (row) => row.imported ? 'Disassocia' : 'Associa', action: (row) => row.imported ? 'secondary' : 'primary' },
    { key: 'referents', labelKey: 'asl.action.manageReferents', formatter: () => 'Referenti', action: () => 'secondary', visible: (row) => row.imported }
  ];

  private allAsls: FilterOption[] = [];
  private allHospitals: FilterOption[] = [];
  referentsDepartment: StructureDepartment | null = null;
  referents: Referent[] = [];
  referentsBusy = false;
  translations: Record<string, string> = {};
  editingReferentId: number | null = null;
  newReferent: Referent = this.emptyReferent();

  readonly fetchResults = (filters: Record<string, string>): Observable<StructureDepartment[]> =>
    this.http.get<StructureDepartment[]>(`${environment.apiBaseUrl}/structure-departments/overview`, { params: filters }).pipe(
      map((records) => records.filter((row) => !filters['imported'] || filters['imported'] === 'all' || (filters['imported'] === 'imported' ? row.imported : !row.imported)))
    );

  constructor(private readonly http: HttpClient, private readonly i18n: I18nPropertiesService) {}

  ngOnInit(): void {
    this.i18n.loadTranslations(navigator.language).subscribe((translations) => this.translations = translations);
    this.http.get<{ regions: FilterOption[]; asls: FilterOption[]; hospitals: FilterOption[] }>(`${environment.apiBaseUrl}/structure-departments/filter-options`).subscribe(options => {
      this.allAsls = options.asls ?? [];
      this.allHospitals = options.hospitals ?? [];
      this.setOptions('regionCode', options.regions ?? []);
      this.setOptions('aslCode', this.allAsls);
      this.setOptions('structureCode', this.allHospitals);
    });
  }

  onFilterChanged(event: { key: string; value: string }): void {
    if (event.key === 'regionCode') {
      this.setFilter('aslCode', null);
      this.setFilter('structureCode', null);
      this.setOptions('aslCode', event.value ? this.allAsls.filter(option => option.regionCode === event.value) : this.allAsls);
      this.setOptions('structureCode', event.value ? this.allHospitals.filter(option => option.regionCode === event.value) : this.allHospitals);
    } else if (event.key === 'aslCode') {
      this.setFilter('structureCode', null);
      const region = this.searchPage?.filterModel['regionCode'];
      this.setOptions('structureCode', this.allHospitals.filter(option => (!region || option.regionCode === region) && (!event.value || option.aslCode === event.value)));
    }
  }

  private setOptions(key: string, options: FilterOption[]): void {
    const filter = this.filters.find(item => item.key === key);
    if (filter) filter.options = options.map(option => ({ value: option.code, label: option.label }));
  }

  private setFilter(key: string, value: string | null): void {
    if (this.searchPage) this.searchPage.filterModel[key] = value as string;
  }

  onAction(event: { column: SearchResultColumn<StructureDepartment>; event: SearchPageActionEvent<StructureDepartment> }): void {
    const row = event.event.row;
    if (event.column.key === 'referents') {
      this.openReferents(row);
      return;
    }
    const params = {
      codiceStruttura: row.codiceStruttura || '',
      codiceDisciplina: row.codiceDisciplina || '',
      descrizioneDisciplina: row.descrizioneDisciplina || row.disciplina || ''
    };
    const request = row.imported
      ? this.http.delete(`${environment.apiBaseUrl}/structure-departments`, { params })
      : this.http.post(`${environment.apiBaseUrl}/structure-departments/import`, params);
    request.subscribe(() => this.searchPage?.reload(false));
  }

  t(key: string): string { return this.translations[key] ?? key; }

  openReferents(row: StructureDepartment): void {
    this.referentsDepartment = row;
    this.referentsBusy = true;
    this.http.get<Referent[]>(`${environment.apiBaseUrl}/structure-departments/${row.id}/referents`).subscribe({ next: value => { this.referents = value ?? []; this.referentsBusy = false; }, error: () => { this.referents = []; this.referentsBusy = false; } });
  }

  closeReferents(): void { this.referentsDepartment = null; this.referents = []; this.cancelEdit(); }
  editReferent(referent: Referent): void { this.editingReferentId = referent.id ?? null; this.newReferent = { ...referent }; }
  cancelEdit(): void { this.editingReferentId = null; this.newReferent = this.emptyReferent(); }
  saveReferent(): void {
    if (!this.referentsDepartment) return;
    this.referentsBusy = true;
    const url = `${environment.apiBaseUrl}/structure-departments/${this.referentsDepartment.id}/referents`;
    const request = this.editingReferentId === null ? this.http.post<Referent[]>(url, this.newReferent) : this.http.put<Referent[]>(`${url}/${this.editingReferentId}`, this.newReferent);
    request.subscribe({ next: value => { this.referents = value; this.referentsBusy = false; this.cancelEdit(); }, error: () => this.referentsBusy = false });
  }
  removeReferent(referent: Referent): void { if (!this.referentsDepartment || referent.id === undefined) return; this.referentsBusy = true; this.http.delete(`${environment.apiBaseUrl}/structure-departments/${this.referentsDepartment.id}/referents/${referent.id}`).subscribe({ next: () => { this.referents = this.referents.filter(item => item.id !== referent.id); this.referentsBusy = false; }, error: () => this.referentsBusy = false }); }
  private emptyReferent(): Referent { return { firstName: '', lastName: '', role: '', phone: '', email: '', note: '' }; }
}
