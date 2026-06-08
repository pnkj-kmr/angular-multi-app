import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { V2HostComponent } from './v2-host/v2-host.component';
import { LegacyPageComponent } from './legacy/legacy-page.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },

  // A couple of stand-ins for the 20+ existing Angular 14 menus.
  { path: 'home', component: LegacyPageComponent, data: { title: 'Home' } },
  { path: 'customers', component: LegacyPageComponent, data: { title: 'Customers' } },

  // All new Angular 21 menus share ONE host/iframe. The :feature param selects
  // the v2 screen; the component instance is reused across switches.
  { path: 'v2/:feature', component: V2HostComponent },
  { path: 'v2', pathMatch: 'full', redirectTo: 'v2/dashboard' },

  { path: '**', redirectTo: 'home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
