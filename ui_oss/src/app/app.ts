import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { V2BridgeService } from './v2-bridge.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly bridge = inject(V2BridgeService);

  /** Standalone (not embedded in the shell) → show a local nav for dev/testing. */
  protected readonly standalone = !this.bridge.embedded;

  constructor() {
    this.bridge.start();
  }
}
