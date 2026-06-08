import { Component } from '@angular/core';

interface MenuItem {
  label: string;
  link: any[];
  badge?: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'Acme Console';

  /** Stand-ins for the existing Angular 14 menus. */
  legacyMenus: MenuItem[] = [
    { label: 'Home', link: ['/home'] },
    { label: 'Customers', link: ['/customers'] },
  ];

  /** New Angular 21 menus — all routed through the single v2 iframe host. */
  v2Menus: MenuItem[] = [
    { label: 'Dashboard', link: ['/v2', 'dashboard'], badge: 'v2' },
    { label: 'Reports', link: ['/v2', 'reports'], badge: 'v2' },
    { label: 'Settings', link: ['/v2', 'settings'], badge: 'v2' },
  ];
}
