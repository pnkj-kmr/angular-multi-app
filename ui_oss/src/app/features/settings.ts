import { Component } from '@angular/core';

@Component({
  selector: 'v2-settings',
  template: `
    <section class="feature">
      <h2>Settings</h2>
      <p>Angular 21 v2 feature.</p>
      <form class="form" (submit)="$event.preventDefault()">
        <label>Display name <input type="text" value="Pankaj" /></label>
        <label>Email <input type="email" value="pnkj3092@example.com" /></label>
        <label class="row"><input type="checkbox" checked /> Email notifications</label>
        <button type="submit">Save</button>
      </form>
    </section>
  `,
  styles: [`
    .form { display: flex; flex-direction: column; gap: .85rem; max-width: 360px; margin-top: 1rem; }
    label { display: flex; flex-direction: column; gap: .3rem; font-size: .9rem; color: #334155; }
    label.row { flex-direction: row; align-items: center; gap: .5rem; }
    input[type=text], input[type=email] { padding: .5rem; border: 1px solid #cbd5e1; border-radius: 6px; }
    button { align-self: flex-start; padding: .55rem 1.1rem; border: 0; border-radius: 6px;
             background: #2563eb; color: #fff; cursor: pointer; }
  `],
})
export class SettingsComponent {}
