import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard } from './core/auth.guard';
import { PatientsTesterComponent } from './patients-tester.component';
import { ChangePasswordComponent } from './shared/change-password/change-password.component';
import { PatientsSearchComponent } from './features/patients-search/patients-search.component';
import { PatientsCrudComponent } from './features/patients/patients-crud.component';
import { MedicinesSearchComponent } from './features/medicines-search/medicines-search.component';
import { MedicinesCrudComponent } from './features/medicines/medicines-crud.component';
import { ProjectsSearchComponent } from './features/projects/projects-search.component';
import { ProjectsCrudComponent } from './features/projects/projects-crud.component';
import { AslManagementComponent } from './features/asl/asl-management.component';
import { AslImportComponent } from './features/asl/asl-import.component';
import { HospitalImportComponent } from './features/hospitals/hospital-import.component';
import { HospitalManagementComponent } from './features/hospitals/hospital-management.component';
import { StructureDepartmentsManagementComponent } from './features/structure-departments/structure-departments-management.component';

/**
 * Definizione rotte applicative minime: login pubblico e dashboard protetta.
 */

import { PasswordRecoverComponent } from './features/login/passwordrecover/passwordrecover.component';
import { ResetPasswordComponent } from './features/login/reset-password/reset-password.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'change-password', component: ChangePasswordComponent },
  { path: 'passwordrecover', component: PasswordRecoverComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: 'patients/search', component: PatientsSearchComponent, canActivate: [authGuard] },
      { path: 'medicines/search', component: MedicinesSearchComponent, canActivate: [authGuard] },
      { path: 'projects/search', component: ProjectsSearchComponent, canActivate: [authGuard] },
      { path: 'projects/new', component: ProjectsCrudComponent, canActivate: [authGuard] },
      { path: 'projects/:id', component: ProjectsCrudComponent, canActivate: [authGuard] },
      { path: 'asl', component: AslManagementComponent, canActivate: [authGuard] },
      { path: 'asl/import', component: AslImportComponent, canActivate: [authGuard] },
      { path: 'hospitals', component: HospitalManagementComponent, canActivate: [authGuard] },
      { path: 'hospitals/import', component: HospitalImportComponent, canActivate: [authGuard] }
      ,{ path: 'structure-departments', component: StructureDepartmentsManagementComponent, canActivate: [authGuard] }
    ]
  },
  { path: 'patients/search', pathMatch: 'full', redirectTo: 'dashboard/patients/search' },
  { path: 'patients/new', component: PatientsCrudComponent, canActivate: [authGuard] },
  { path: 'patients/:id', component: PatientsCrudComponent, canActivate: [authGuard] },
  { path: 'patients/:id/view', component: PatientsCrudComponent, canActivate: [authGuard], data: { mode: 'view' } },
  { path: 'medicines/search', pathMatch: 'full', redirectTo: 'dashboard/medicines/search' },
  { path: 'medicines/new', component: MedicinesCrudComponent, canActivate: [authGuard] },
  { path: 'medicines/:id', component: MedicinesCrudComponent, canActivate: [authGuard] },
  { path: 'medicines/:id/view', component: MedicinesCrudComponent, canActivate: [authGuard], data: { mode: 'view' } },
  { path: 'patients-tester', component: PatientsTesterComponent, canActivate: [authGuard] },
  { path: 'projects/search', pathMatch: 'full', redirectTo: 'dashboard/projects/search' },
  { path: 'projects/new', pathMatch: 'full', redirectTo: 'dashboard/projects/new' },
  { path: 'projects/:id', pathMatch: 'full', redirectTo: 'dashboard/projects/:id' },
  { path: '**', redirectTo: 'login' }
];
