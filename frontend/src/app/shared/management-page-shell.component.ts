import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { I18nPropertiesService } from '../core/i18n-properties.service';

@Component({
  selector: 'app-management-page-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card dashboard-content-card asl-management-shell">
      <div class="dashboard-header">
        <div class="asl-page-heading">
          <h2>{{ t(titleKey) }}</h2>
          <p>{{ t(subtitleKey) }}</p>
        </div>
        <div class="asl-header-actions">
          <ng-content select="[management-page-actions]"></ng-content>
          <button
            *ngIf="showFilterToggle"
            class="btn btn-outline asl-filter-toggle"
            type="button"
            (click)="toggleFilters()"
            [attr.aria-expanded]="showFilters"
          >
            <span class="asl-filter-toggle-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M5 9H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M7 13H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            {{ t(filterToggleKey) }}
          </button>
        </div>
      </div>

      <ng-content select="[management-page-info]"></ng-content>

      <section *ngIf="showFilters" class="management-page-filters">
        <ng-content select="[management-page-filters]"></ng-content>
      </section>

      <ng-content select="[management-page-message]"></ng-content>
      <ng-content select="[management-page-content]"></ng-content>
    </div>
  `
})
export class ManagementPageShellComponent {
  @Input({ required: true }) titleKey!: string;
  @Input({ required: true }) subtitleKey!: string;
  @Input() filterToggleKey = 'asl.actions.filters';
  @Input() showFilterToggle = true;
  @Input() showFilters = true;
  @Output() readonly showFiltersChange = new EventEmitter<boolean>();

  translations: Record<string, string> = {};

  constructor(private readonly i18n: I18nPropertiesService) {
    this.i18n.loadTranslations(navigator.language).subscribe((translations) => {
      this.translations = translations;
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    this.showFiltersChange.emit(this.showFilters);
  }
}
