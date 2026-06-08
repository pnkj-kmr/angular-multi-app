import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  PROTOCOL_VERSION,
  ShellToV2,
  isV2ToShell,
} from '../shared/messages';

type HostStatus = 'loading' | 'ready' | 'error';

/**
 * Hosts the Angular 21 v2 app in a single, persistent, same-origin iframe
 * (docs/app1.md Phases 2-4).
 *
 *  - The iframe is mounted once. Switching v2 menus changes the `:feature` route
 *    param, which reuses this same component instance and sends a `shell:navigate`
 *    message instead of reloading the iframe — so Angular 21 bootstraps only once.
 *  - A `v2:ready` handshake (with timeout + retry) gates the first message.
 *  - v2 reports its own navigations back (`v2:navigated`) so the shell URL stays
 *    in sync (replaceUrl) for refresh / bookmark / back-button.
 *  - 401/403 inside v2 surfaces as `v2:auth-expired` → full-page login redirect.
 */
@Component({
  selector: 'app-v2-host',
  templateUrl: './v2-host.component.html',
  styleUrls: ['./v2-host.component.css'],
})
export class V2HostComponent implements OnInit, OnDestroy {
  @ViewChild('frame', { static: true })
  frame!: ElementRef<HTMLIFrameElement>;

  /**
   * Same-origin path that serves the static Angular 21 app. Note this is
   * deliberately DIFFERENT from the shell's own `/v2/:feature` route, so that
   * refreshing `/v2/reports` is handled by the shell (which mounts this iframe)
   * rather than serving the v2 app standalone.
   */
  readonly src = '/v2-app/';
  status: HostStatus = 'loading';

  private ready = false;
  private pendingFeature: string | null = null;
  private sub?: Subscription;
  private handshakeTimer?: ReturnType<typeof setTimeout>;
  private readonly handshakeTimeoutMs = 8000;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);

    // Route param drives which v2 screen is shown. The component instance is
    // reused across menu switches, so this fires without remounting the iframe.
    this.sub = this.route.paramMap.subscribe((p) => {
      const feature = p.get('feature') || '';
      this.pendingFeature = feature; // latest-wins for rapid switching
      this.push(feature);
    });

    this.armHandshakeTimeout();
  }

  /** iframe finished loading the document; if v2 never says ready, surface an error. */
  onFrameLoad(): void {
    // Only (re)arm if we're still waiting for the handshake.
    if (!this.ready) this.armHandshakeTimeout();
  }

  retry(): void {
    this.ready = false;
    this.status = 'loading';
    this.armHandshakeTimeout();
    // Force the iframe to reload the v2 app.
    const el = this.frame.nativeElement;
    // eslint-disable-next-line no-self-assign
    el.src = this.src;
  }

  private onMessage = (e: MessageEvent): void => {
    if (e.origin !== location.origin) return; // always validate origin
    if (!isV2ToShell(e.data)) return;          // ignore unknown/malformed
    if (e.data.v !== PROTOCOL_VERSION) {
      // Version skew (Phase 5): degrade gracefully rather than break.
      console.warn('[v2-host] protocol version mismatch', e.data);
      return;
    }

    // Messages arrive outside Angular's zone; re-enter so the view updates.
    this.zone.run(() => {
      switch (e.data.type) {
        case 'v2:ready':
          this.ready = true;
          this.status = 'ready';
          this.clearHandshakeTimeout();
          this.push(this.pendingFeature ?? '');
          break;

        case 'v2:navigated':
          // Keep the shell URL in sync without adding history entries.
          this.router.navigate(['/v2', e.data.feature], { replaceUrl: true });
          break;

        case 'v2:auth-expired':
          // Never show login inside the iframe — redirect the whole window.
          window.location.href =
            '/login?returnUrl=' + encodeURIComponent(location.pathname);
          break;
      }
    });
  };

  private push(feature: string): void {
    if (!this.ready || !feature) return;
    const msg: ShellToV2 = {
      v: PROTOCOL_VERSION,
      type: 'shell:navigate',
      feature,
    };
    this.frame.nativeElement.contentWindow?.postMessage(msg, location.origin);
  }

  private armHandshakeTimeout(): void {
    this.clearHandshakeTimeout();
    this.handshakeTimer = setTimeout(() => {
      if (!this.ready) {
        this.zone.run(() => (this.status = 'error'));
      }
    }, this.handshakeTimeoutMs);
  }

  private clearHandshakeTimeout(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
    this.clearHandshakeTimeout();
    this.sub?.unsubscribe();
  }
}
