import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

/** Stand-in for one of the 20+ existing Angular 14 menus. */
@Component({
  selector: 'app-legacy-page',
  template: `
    <div class="legacy">
      <h2>{{ (title$ | async) }}</h2>
      <p>This is an existing <strong>Angular 14</strong> screen rendered directly by the shell.</p>
      <p class="muted">No iframe here — only the new v2 menus are embedded.</p>
    </div>
  `,
  styles: [`
    .legacy { padding: 1.5rem; }
    .muted { color: #64748b; }
  `],
})
export class LegacyPageComponent {
  title$ = this.route.data.pipe(map((d) => d['title'] as string));
  constructor(private route: ActivatedRoute) {}
}
