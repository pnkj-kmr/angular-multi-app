import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard';
import { ReportsComponent } from './features/reports';
import { SettingsComponent } from './features/settings';

/**
 * v2 internal routes. The shell maps a `feature` slug (from /v2/:feature) onto
 * one of these paths via a `shell:navigate` message — see app.ts and the shell's
 * V2HostComponent. Keep the slugs here in sync with the shell's menu items.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: 'dashboard' },
];
