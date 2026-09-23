import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgIf } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService, DashboardResponse, DashboardUserProject, TenantInfo } from '../../core/auth.service';
import { I18nPropertiesService } from '../../core/i18n-properties.service';

/**
 * Pagina login che invia username/password al backend per autenticazione Keycloak.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private static readonly technicalClientCodes = new Set(['account']);

  errorMessage = '';
  infoMessage = '';
  translations: Record<string, string> = {};
  decodedClaims: Record<string, unknown> | null = null;
  passwordVisible = false;
  readonly loginForm;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly i18nPropertiesService: I18nPropertiesService
  ) {
    this.loginForm = this.formBuilder.nonNullable.group({
      username: ['francesco.tripodi', [Validators.required]],
      password: ['Qtm!2026', [Validators.required]]
    });
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  ngOnInit(): void {
    this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
      next: (translationMap) => {
        this.translations = translationMap;
        this.route.queryParamMap.subscribe((params) => {
          this.infoMessage = params.get('passwordChanged') === 'true'
            ? this.t('login.info.passwordChanged')
            : '';
        });
      }
    });
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.errorMessage = this.t('login.error.requiredCredentials');
      return;
    }

    const { username, password } = this.loginForm.getRawValue();
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      this.errorMessage = this.t('login.error.requiredCredentials');
      return;
    }

    this.errorMessage = '';

    this.authService.login(normalizedUsername, password).subscribe({
      next: (response) => {
        if (response.mustChangePassword) {
          void this.router.navigate(['/change-password'], {
            queryParams: {
              username: normalizedUsername,
              reason: 'first-access'
            }
          });
          return;
        }
        this.redirectAfterLogin();
      },
      error: () => {
        this.errorMessage = this.t('login.error.failedAccess');
      }
    });
  }

  private redirectAfterLogin(): void {
    forkJoin({
      dashboard: this.authService.getDashboardData(),
      tenants: this.authService.getAllTenants().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ dashboard, tenants }) => {
        this.applyJwtDebugInfo(dashboard);
        const groupedProjects = this.buildGroupedProjects(
          Array.isArray(dashboard.userProjects) ? dashboard.userProjects : [],
          tenants
        );
        const projects = groupedProjects.flatMap((group) => group.projects);

        if (projects.length === 1) {
          this.openSingleDashboardBox(projects[0]);
          return;
        }

        void this.router.navigate(['/dashboard']);
      },
      error: () => {
        void this.router.navigate(['/dashboard']);
      }
    });
  }

  private openSingleDashboardBox(project: DashboardUserProject): void {
    const client = project.tenantCode?.trim();
    const role = project.roleId?.trim();
    const token = this.authService.getToken();

    if (!client || !role || !token) {
      void this.router.navigate(['/dashboard']);
      return;
    }

    this.authService.resolveTenantAppUrl(client).subscribe({
      next: (resolution) => {
        const targetUrl = this.buildTenantTargetUrl(resolution.tenantAppUrl);
        // FIXME Francesco: se il tenant punta a questa stessa app, usare il router interno e non ricaricare la root applicativa.
        if (this.isCurrentApplication(targetUrl)) {
          void this.router.navigate(['/dashboard']);
          return;
        }
        targetUrl.searchParams.set('token', token);
        targetUrl.searchParams.set('client', client);
        targetUrl.searchParams.set('role', role);

        const projectCode = project.projectCode?.trim();
        if (projectCode) {
          targetUrl.searchParams.set('project', projectCode);
        }

        window.location.assign(targetUrl.toString());
      },
      error: () => {
        void this.router.navigate(['/dashboard']);
      }
    });
  }

  private applyJwtDebugInfo(response: DashboardResponse): void {
    const backendClaims = this.normalizeClaims(response.decodedClaims);
    const tokenClaims = this.decodeClaimsFromCurrentToken();
    this.decodedClaims = backendClaims ?? tokenClaims;
  }

  private decodeClaimsFromCurrentToken(): Record<string, unknown> | null {
    const token = this.authService.getToken();
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const payload = this.decodeBase64Url(parts[1]);
      const parsed = JSON.parse(payload) as unknown;
      return this.normalizeClaims(parsed);
    } catch {
      return null;
    }
  }

  private normalizeClaims(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private decodeBase64Url(value: string): string {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(paddingLength);
    return atob(padded);
  }

  private buildGroupedProjects(
    userProjects: DashboardUserProject[],
    tenants: TenantInfo[]
  ): Array<{ tenantCode: string, tenantName: string, projects: DashboardUserProject[] }> {
    const allowedClientCodes = this.extractAllowedClientCodes();
    const filteredProjects = userProjects.filter((project) => {
      const tenantCode = project.tenantCode?.trim();
      return tenantCode ? allowedClientCodes.has(tenantCode) : false;
    });

    const projectsByTenant = filteredProjects.reduce<Record<string, DashboardUserProject[]>>((accumulator, project) => {
      const tenantCode = project.tenantCode?.trim();
      if (!tenantCode) {
        return accumulator;
      }

      const currentProjects = accumulator[tenantCode] ?? [];
      accumulator[tenantCode] = [...currentProjects, project];
      return accumulator;
    }, {});

    const fallbackTenants = Object.entries(projectsByTenant).map(([tenantCode, projects]) => ({
      id: projects[0]?.tenantId ?? 0,
      clientCode: tenantCode,
      clientName: projects[0]?.tenantName ?? tenantCode,
      enabled: true,
      tenantAppUrl: ''
    }));

    const effectiveTenants = (tenants.length > 0 ? tenants : fallbackTenants)
      .filter((tenant) => tenant.enabled)
      .filter((tenant) => allowedClientCodes.has(tenant.clientCode));

    return effectiveTenants.map((tenant) => ({
      tenantCode: tenant.clientCode,
      tenantName: tenant.clientName,
      projects: this.resolveTenantProjects(tenant, projectsByTenant[tenant.clientCode] ?? [])
    }));
  }

  private resolveTenantProjects(tenant: TenantInfo, projects: DashboardUserProject[]): DashboardUserProject[] {
    const uniqueProjects = projects.filter((project, index, source) => {
      const currentKey = this.buildProjectIdentity(project);
      return source.findIndex((candidate) => this.buildProjectIdentity(candidate) === currentKey) === index;
    });

    if (uniqueProjects.length === 0) {
      return [this.createSyntheticSuperAdminProject(tenant)];
    }

    const hasSpecificProjects = uniqueProjects.some((project) => !this.isSuperAdminAllProjects(project));
    if (!hasSpecificProjects) {
      const superAdminProject = uniqueProjects.find((project) => this.isSuperAdminAllProjects(project));
      return superAdminProject ? [superAdminProject] : [this.createSyntheticSuperAdminProject(tenant)];
    }

    return uniqueProjects.filter((project) => !this.isSuperAdminAllProjects(project));
  }

  private buildProjectIdentity(project: DashboardUserProject): string {
    return [
      project.tenantCode?.trim() ?? '',
      project.roleId?.trim() ?? '',
      project.projectCode?.trim() ?? '',
      project.projectId?.toString() ?? ''
    ].join('|');
  }

  private isSuperAdminAllProjects(project: DashboardUserProject): boolean {
    const normalizedProjectCode = project.projectCode?.trim().toUpperCase() ?? '';
    return project.roleId === 'SUPER_ADMIN' && (normalizedProjectCode === '' || normalizedProjectCode === 'TUTTI');
  }

  private createSyntheticSuperAdminProject(tenant: TenantInfo): DashboardUserProject {
    return {
      userId: 0,
      username: this.loginForm.controls.username.getRawValue(),
      tenantId: tenant.id,
      tenantCode: tenant.clientCode,
      tenantName: tenant.clientName,
      projectCode: 'Tutti',
      projectDescription: '',
      superuser: true,
      roleId: 'SUPER_ADMIN'
    };
  }

  private extractAllowedClientCodes(): Set<string> {
    const resourceAccess = this.decodedClaims?.['resource_access'];
    if (!resourceAccess || typeof resourceAccess !== 'object' || Array.isArray(resourceAccess)) {
      return new Set();
    }

    return new Set(
      Object.keys(resourceAccess)
        .map((clientCode) => clientCode.trim())
        .filter((clientCode) => clientCode.length > 0)
        .filter((clientCode) => !LoginComponent.technicalClientCodes.has(clientCode))
    );
  }

  private buildTenantTargetUrl(rawTenantUrl: string): URL {
    const normalizedUrl = rawTenantUrl?.trim();

    if (!normalizedUrl) {
      return new URL('/dashboard', window.location.origin);
    }

    const targetUrl = /^https?:\/\//i.test(normalizedUrl)
      ? new URL(normalizedUrl)
      : new URL(normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`, window.location.origin);

    if (targetUrl.pathname === '' || targetUrl.pathname === '/') {
      targetUrl.pathname = '/dashboard';
    }

    return targetUrl;
  }

  // FIXME Francesco: centralizzare questa logica in un servizio unico di navigazione tenant.
  private isCurrentApplication(targetUrl: URL): boolean {
    const appBaseUrl = new URL(document.baseURI);
    const normalizedTargetPath = targetUrl.pathname.replace(/\/+$/, '') || '/';
    const normalizedBasePath = appBaseUrl.pathname.replace(/\/+$/, '') || '/';

    return targetUrl.origin === appBaseUrl.origin && normalizedTargetPath === normalizedBasePath;
  }
}
