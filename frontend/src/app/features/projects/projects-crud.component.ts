import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, TenantInfo } from '../../core/auth.service';
import { I18nPropertiesService } from '../../core/i18n-properties.service';
import { ProjectApiService, ProjectDto } from '../../core/project-api.service';
import { QtmStepModalComponent } from '../../shared/qtm-step-modal.component';

interface ProjectDraft {
  code: string;
  descrizione: string;
  logo: string;
  emailSender: string;
  jsonVisit: string;
  jsonSurvey: string;
  dataInizio: string;
  dataFine: string;
  footer: string;
}

/**
 * Wizard minimo di creazione progetto per ripristinare una pagina dedicata su /projects/new.
 */
@Component({
  selector: 'app-projects-crud',
  standalone: true,
  imports: [CommonModule, FormsModule, QtmStepModalComponent],
  template: `
    <qtm-step-modal
      [title]="t('projects.wizard.title')"
      [step]="step"
      [totalSteps]="2"
      [stepTitle]="t(step === 1 ? 'projects.wizard.step.general.title' : 'projects.wizard.step.summary.title')"
      [stepDescription]="t(step === 1 ? 'projects.wizard.subtitle' : 'projects.wizard.step.summary.heading')"
      (close)="cancel()"
    >
      <div *ngIf="errorMessage" class="projects-error">{{ errorMessage }}</div>

      <div *ngIf="step === 1" class="projects-form-grid">
        <div class="projects-field">
          <label for="project-tenant">{{ t('projects.field.tenant') }}</label>
          <select id="project-tenant" [(ngModel)]="selectedTenantId">
            <option [ngValue]="null">{{ t('projects.field.tenantPlaceholder') }}</option>
            <option *ngFor="let tenant of availableTenants" [ngValue]="tenant.id">{{ tenant.clientName }} ({{ tenant.clientCode }})</option>
          </select>
        </div>

        <div class="projects-field">
          <label for="project-code">{{ t('projects.field.code') }}</label>
          <input id="project-code" type="text" [(ngModel)]="draft.code" (ngModelChange)="syncFooter()" />
        </div>

        <div class="projects-field">
          <label for="project-description">{{ t('projects.field.descrizione') }}</label>
          <input id="project-description" type="text" [(ngModel)]="draft.descrizione" (ngModelChange)="syncFooter()" />
        </div>

        <div class="projects-field">
          <label for="project-logo">{{ t('projects.field.logo') }}</label>
          <input id="project-logo" type="text" [(ngModel)]="draft.logo" />
        </div>

        <div class="projects-field">
          <label for="project-email">{{ t('projects.field.emailSender') }}</label>
          <input id="project-email" type="email" [(ngModel)]="draft.emailSender" (ngModelChange)="syncFooter()" />
        </div>

        <div class="projects-field projects-field-wide">
          <label for="project-json-visit">{{ t('projects.field.jsonVisit') }}</label>
          <textarea id="project-json-visit" rows="5" [(ngModel)]="draft.jsonVisit"></textarea>
        </div>

        <div class="projects-field">
          <label for="project-start">{{ t('projects.field.dataInizio') }}</label>
          <input id="project-start" type="date" [(ngModel)]="draft.dataInizio" (ngModelChange)="syncFooter()" />
        </div>

        <div class="projects-field">
          <label for="project-end">{{ t('projects.field.dataFine') }}</label>
          <input id="project-end" type="date" [(ngModel)]="draft.dataFine" (ngModelChange)="syncFooter()" />
        </div>

        <div class="projects-field projects-field-wide">
          <label for="project-footer">{{ t('projects.field.footer') }}</label>
          <textarea id="project-footer" rows="4" [(ngModel)]="draft.footer"></textarea>
          <div class="projects-field-hint">{{ t('projects.field.footerHint') }}</div>
        </div>
      </div>

      <div *ngIf="step === 2" class="projects-summary-grid">
        <div class="projects-field projects-field-wide">
          <label for="project-json-survey">{{ t('projects.field.jsonSurvey') }}</label>
          <textarea id="project-json-survey" rows="12" [(ngModel)]="draft.jsonSurvey"></textarea>
        </div>

        <div class="projects-summary-item">
          <strong>{{ t('projects.field.tenant') }}</strong>
          <span>{{ selectedTenantLabel }}</span>
        </div>
        <div class="projects-summary-item">
          <strong>{{ t('projects.field.code') }}</strong>
          <span>{{ draft.code || '-' }}</span>
        </div>
        <div class="projects-summary-item">
          <strong>{{ t('projects.field.descrizione') }}</strong>
          <span>{{ draft.descrizione || '-' }}</span>
        </div>
        <div class="projects-summary-item">
          <strong>{{ t('projects.field.emailSender') }}</strong>
          <span>{{ draft.emailSender || '-' }}</span>
        </div>
        <div class="projects-summary-item projects-summary-item-wide">
          <strong>{{ t('projects.field.jsonVisit') }}</strong>
          <span>{{ draft.jsonVisit || '-' }}</span>
        </div>
        <div class="projects-summary-item">
          <strong>{{ t('projects.field.dataInizio') }}</strong>
          <span>{{ draft.dataInizio || '-' }}</span>
        </div>
        <div class="projects-summary-item">
          <strong>{{ t('projects.field.dataFine') }}</strong>
          <span>{{ draft.dataFine || '-' }}</span>
        </div>
        <div class="projects-summary-item projects-summary-item-wide">
          <strong>{{ t('projects.field.footer') }}</strong>
          <span>{{ draft.footer || '-' }}</span>
        </div>
      </div>

      <div modal-actions>
        <button type="button" class="btn btn-outline" (click)="cancel()">{{ t('crud.actions.cancel') }}</button>
        <button *ngIf="step === 2" type="button" class="btn btn-outline" (click)="step = 1">{{ t('projects.wizard.actions.previous') }}</button>
        <button *ngIf="step === 1" type="button" class="btn btn-primary" (click)="goToSummary()">{{ t('projects.wizard.actions.next') }}</button>
        <button *ngIf="step === 2" type="button" class="btn btn-primary" (click)="confirmCreation()">{{ t('crud.actions.create') }}</button>
      </div>
    </qtm-step-modal>
  `,
  styles: [`
    .projects-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .projects-field-wide,
    .projects-summary-item-wide {
      grid-column: 1 / -1;
    }

    .projects-field-hint {
      color: #5f7596;
      font-size: 0.88rem;
      line-height: 1.4;
      margin-top: 6px;
    }

    .projects-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .projects-summary-item,
    .projects-error {
      border: 1px solid #d7e7fb;
      border-radius: 18px;
      padding: 16px 18px;
      background: #f8fbff;
    }

    .projects-summary-item strong {
      display: block;
      color: #175fcb;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .projects-summary-item span {
      color: #25364f;
      white-space: pre-line;
      word-break: break-word;
    }

    .projects-error {
      color: #b42318;
      border-color: #fecaca;
      background: #fef2f2;
      margin-bottom: 16px;
    }

    @media (max-width: 960px) {
      .projects-form-grid,
      .projects-summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ProjectsCrudComponent implements OnInit, OnDestroy {
  translations: Record<string, string> = {};
  step = 1;
  errorMessage = '';
  availableTenants: TenantInfo[] = [];
  selectedTenantId: number | null = null;
  private projectId: number | null = null;
  private loadedProject: ProjectDto | null = null;
  draft: ProjectDraft = {
    code: '',
    descrizione: '',
    logo: '',
    emailSender: '',
    jsonVisit: '',
    jsonSurvey: '',
    dataInizio: '',
    dataFine: '',
    footer: ''
  };
  private autoGeneratedFooter = '';
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly i18nPropertiesService: I18nPropertiesService,
    private readonly projectApiService: ProjectApiService
  ) {}

  ngOnInit(): void {
    const routeProjectId = this.activatedRoute.snapshot.paramMap.get('id');
    this.projectId = routeProjectId ? Number(routeProjectId) : null;

    this.subscriptions.add(
      this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
        next: (translationMap) => {
          this.translations = translationMap;
          this.syncFooter();

          if (this.projectId !== null) {
            this.loadProject(this.projectId);
          }
        }
      })
    );

    this.loadTenants();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  get selectedTenantLabel(): string {
    const selectedTenant = this.availableTenants.find((tenant) => tenant.id === this.selectedTenantId);
    return selectedTenant ? `${selectedTenant.clientName} (${selectedTenant.clientCode})` : '-';
  }

  goToSummary(): void {
    this.errorMessage = '';

    if (this.selectedTenantId === null) {
      this.errorMessage = this.t('projects.wizard.validation.tenantRequired');
      return;
    }

    if (!this.draft.code.trim() || !this.draft.descrizione.trim()) {
      this.errorMessage = this.t('projects.wizard.validation.generalRequired');
      return;
    }

    if (!this.draft.emailSender.trim()) {
      this.errorMessage = this.t('projects.wizard.validation.emailSenderRequired');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.draft.emailSender.trim())) {
      this.errorMessage = this.t('projects.wizard.validation.emailSenderInvalid');
      return;
    }

    if (!this.draft.dataInizio || !this.draft.dataFine) {
      this.errorMessage = this.t('projects.wizard.validation.datesRequired');
      return;
    }

    if (this.draft.dataInizio > this.draft.dataFine) {
      this.errorMessage = this.t('projects.wizard.validation.dateRange');
      return;
    }

    this.step = 2;
  }

  confirmCreation(): void {
    this.errorMessage = '';

    if (!this.isSurveyJsonValid()) {
      this.errorMessage = this.t('projects.wizard.validation.surveyJsonInvalid');
      return;
    }

    if (this.projectId !== null) {
      this.updateProject();
      return;
    }

    this.createProject();
  }

  cancel(): void {
    void this.router.navigateByUrl('/dashboard/projects/search');
  }

  syncFooter(): void {
    const template = this.t('projects.footer.template').replace(/\\n/g, '\n');
    const nextFooter = template
      .replaceAll('{CodProgetto}', this.formatValue(this.draft.code))
      .replaceAll('{descProgetto}', this.formatValue(this.draft.descrizione))
      .replaceAll('{dataInizio}', this.formatValue(this.draft.dataInizio))
      .replaceAll('{dataFine}', this.formatValue(this.draft.dataFine))
      .replaceAll('{mail}', this.formatValue(this.draft.emailSender));

    if (!this.draft.footer || this.draft.footer === this.autoGeneratedFooter) {
      this.draft.footer = nextFooter;
    }

    this.autoGeneratedFooter = nextFooter;
  }

  private formatValue(value: string | null | undefined): string {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : '-';
  }

  private isSurveyJsonValid(): boolean {
    if (!this.draft.jsonSurvey.trim()) {
      return true;
    }

    try {
      JSON.parse(this.draft.jsonSurvey);
      return true;
    } catch {
      return false;
    }
  }

  private loadProject(id: number): void {
    this.subscriptions.add(
      this.projectApiService.getProject(id).subscribe({
        next: (project) => {
          this.loadedProject = project;
          this.selectedTenantId = project.tenantId ?? null;
          this.draft = {
            code: project.code ?? '',
            descrizione: project.descrizione ?? '',
            logo: project.logo ?? '',
            emailSender: project.emailSender ?? '',
            jsonVisit: project.jsonVisit ?? '',
            jsonSurvey: project.jsonSurvey ?? '',
            dataInizio: project.dataInizio ?? '',
            dataFine: project.dataFine ?? '',
            footer: project.footer ?? ''
          };
          this.syncFooter();
        },
        error: () => {
          this.errorMessage = this.t('projects.error.load');
        }
      })
    );
  }

  private loadTenants(): void {
    this.subscriptions.add(
      this.authService.getAllTenants().subscribe({
        next: (tenants) => {
          this.availableTenants = [...tenants]
            .filter((tenant) => tenant.enabled)
            .sort((left, right) => left.clientName.localeCompare(right.clientName));
        },
        error: (error) => {
          this.errorMessage = this.resolveErrorMessage(error, 'projects.error.tenants');
        }
      })
    );
  }

  private createProject(): void {
    if (this.selectedTenantId === null) {
      this.errorMessage = this.t('projects.wizard.validation.tenantRequired');
      return;
    }

    const selectedTenant = this.availableTenants.find((tenant) => tenant.id === this.selectedTenantId);
    const payload: ProjectDto = {
      code: this.draft.code.trim(),
      tenantId: this.selectedTenantId,
      tenant: selectedTenant?.clientName,
      clientCode: selectedTenant?.clientCode,
      descrizione: this.draft.descrizione.trim(),
      logo: this.draft.logo.trim(),
      emailSender: this.draft.emailSender.trim(),
      jsonVisit: this.draft.jsonVisit.trim(),
      jsonSurvey: this.draft.jsonSurvey.trim(),
      dataInizio: this.draft.dataInizio,
      dataFine: this.draft.dataFine,
      footer: this.draft.footer.trim()
    };
    this.subscriptions.add(
      this.projectApiService.createProject(payload).subscribe({
        next: () => {
          void this.router.navigateByUrl('/dashboard/projects/search');
        },
        error: (error) => {
          this.errorMessage = this.resolveErrorMessage(error, 'projects.error.create');
        }
      })
    );
  }

  private updateProject(): void {
    if (this.projectId === null || this.loadedProject === null) {
      this.errorMessage = this.t('projects.error.load');
      return;
    }

    const payload: ProjectDto = {
      ...this.loadedProject,
      code: this.draft.code.trim(),
      tenantId: this.selectedTenantId ?? this.loadedProject.tenantId,
      descrizione: this.draft.descrizione.trim(),
      logo: this.draft.logo.trim(),
      emailSender: this.draft.emailSender.trim(),
      jsonVisit: this.draft.jsonVisit.trim(),
      jsonSurvey: this.draft.jsonSurvey.trim(),
      dataInizio: this.draft.dataInizio,
      dataFine: this.draft.dataFine,
      footer: this.draft.footer.trim()
    };
    delete payload.administrators;

    this.subscriptions.add(
      this.projectApiService.updateProject(this.projectId, payload).subscribe({
        next: () => {
          void this.router.navigateByUrl('/dashboard/projects/search');
        },
        error: (error) => {
          this.errorMessage = this.resolveErrorMessage(error, 'projects.error.update');
        }
      })
    );
  }

  private resolveErrorMessage(error: unknown, fallbackKey: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendError = error.error;

      if (backendError && typeof backendError === 'object') {
        const detail = backendError['detail'];
        if (typeof detail === 'string' && detail.trim().length > 0) {
          return detail;
        }

        const message = backendError['message'];
        if (typeof message === 'string' && message.trim().length > 0) {
          return message;
        }
      }

      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }
    }

    return this.t(fallbackKey);
  }
}