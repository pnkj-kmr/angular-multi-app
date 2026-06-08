import { Component } from '@angular/core';

@Component({
  selector: 'v2-dashboard',
  template: `
    <section class="feature">
      <h2>Dashboard</h2>
      <p>Angular 21 v2 feature — rendered inside the shell's iframe.</p>
      <div class="cards">
        <div class="card"><span class="num">128</span><span>Active</span></div>
        <div class="card"><span class="num">42</span><span>Pending</span></div>
        <div class="card"><span class="num">7</span><span>Failed</span></div>
      </div>
    </section>
  `,
  styles: [`
    .cards { display: flex; gap: 1rem; margin-top: 1rem; }
    .card { flex: 1; padding: 1.25rem; border: 1px solid #e2e8f0; border-radius: 10px;
            display: flex; flex-direction: column; gap: .25rem; background: #fff; }
    .num { font-size: 2rem; font-weight: 700; color: #2563eb; }
  `],
})
export class DashboardComponent {}
