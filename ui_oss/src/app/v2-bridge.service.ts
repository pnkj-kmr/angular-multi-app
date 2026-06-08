import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import {
  PROTOCOL_VERSION,
  V2ToShell,
  isShellToV2,
} from './shared/messages';

/**
 * v2 side of the shell<->iframe contract (docs/app1.md Phases 2 & 3).
 *
 *  - announces `v2:ready` to the shell once Angular has booted (with a few
 *    retries in case the shell's listener isn't attached yet);
 *  - listens for `shell:navigate` and drives the v2 router;
 *  - reports every internal navigation back up as `v2:navigated` so the shell
 *    can keep its own URL (/v2/:feature) in sync.
 *
 * Auth handling (`v2:auth-expired`) is emitted from the HTTP interceptor, not here.
 */
@Injectable({ providedIn: 'root' })
export class V2BridgeService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private sub?: Subscription;
  private readyTimer?: ReturnType<typeof setInterval>;

  /** True when running embedded in the shell rather than standalone. */
  readonly embedded = window.parent !== window;

  start(): void {
    if (!this.embedded) return; // standalone dev mode: no bridge needed

    window.addEventListener('message', this.onMessage);

    // Mirror every internal navigation up to the shell.
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const feature = e.urlAfterRedirects.split('?')[0].split('/').filter(Boolean)[0] ?? '';
        this.post({ v: PROTOCOL_VERSION, type: 'v2:navigated', feature });
      });

    // Announce readiness, retrying briefly to win any race with the shell's listener.
    let attempts = 0;
    const announce = () => {
      this.post({ v: PROTOCOL_VERSION, type: 'v2:ready', protocolVersion: PROTOCOL_VERSION });
      if (++attempts >= 5 && this.readyTimer) clearInterval(this.readyTimer);
    };
    announce();
    this.readyTimer = setInterval(announce, 300);
  }

  /** Called by the shell-driven navigation to stop the ready pings once connected. */
  private stopAnnouncing(): void {
    if (this.readyTimer) {
      clearInterval(this.readyTimer);
      this.readyTimer = undefined;
    }
  }

  private onMessage = (e: MessageEvent): void => {
    if (e.origin !== location.origin) return; // always validate origin
    if (!isShellToV2(e.data)) return;          // ignore unknown/malformed messages
    if (e.data.v !== PROTOCOL_VERSION) return; // version skew: ignore (Phase 5)

    this.stopAnnouncing(); // the shell is clearly listening now
    // postMessage fires outside Angular's zone; re-enter so routing triggers CD.
    this.zone.run(() => this.router.navigateByUrl('/' + e.data.feature));
  };

  private post(msg: V2ToShell): void {
    window.parent.postMessage(msg, location.origin);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
    this.sub?.unsubscribe();
    this.stopAnnouncing();
  }
}
