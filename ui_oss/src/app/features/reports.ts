import { Component } from '@angular/core';

@Component({
  selector: 'v2-reports',
  template: `
    <section class="feature">
      <h2>Reports</h2>
      <p>Angular 21 v2 feature — deep-linkable at <code>/v2/reports</code>.</p>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>R-1001</td><td>Q2 Revenue</td><td>Ready</td></tr>
          <tr><td>R-1002</td><td>Churn Analysis</td><td>Running</td></tr>
          <tr><td>R-1003</td><td>Cohort Retention</td><td>Queued</td></tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: #fff; }
    th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid #e2e8f0; }
    th { color: #64748b; font-weight: 600; font-size: .85rem; }
  `],
})
export class ReportsComponent {}
