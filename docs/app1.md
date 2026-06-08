# Implementation Plan: Embedding an Angular 21 App into an Angular 14 Shell via Same-Origin Iframe

## 1. Goal

Add 5–10 new menus, built in Angular 21, to an existing Angular 14 application (20+ menus) **without** upgrading the legacy app and **without** blocking new feature delivery.

The Angular 14 app remains the **shell**: it owns the global navigation menu, the page chrome (header/sidebar), authentication, and routing. The new menus are built in a separate Angular 21 app and rendered inside a **single, persistent, same-origin iframe** in the shell's content area. The shell drives which v2 screen is shown by messaging the iframe — it does not reload it per menu.

## 2. Architecture Summary

```
                 nginx (single origin: https://app.example.com)
                 ├── /            → Angular 14 shell (root app)
                 └── /v2/         → Angular 21 app (new menus)

  Browser
  ┌─────────────────────────────────────────────────────────┐
  │  Angular 14 Shell                                         │
  │  ┌─────────────┐   ┌─────────────────────────────────┐   │
  │  │  Menu       │   │  <iframe src="/v2/">             │   │
  │  │  - Legacy×20│   │  ┌───────────────────────────┐   │   │
  │  │  - New ×5-10│──▶│  │  Angular 21 app (router)  │   │   │
  │  └─────────────┘   │  └───────────────────────────┘   │   │
  │       postMessage ◀──────────────▶ postMessage         │   │
  └─────────────────────────────────────────────────────────┘
```

Key decisions:

- **Same origin.** Both apps are served from one nginx origin, so the session cookie is first-party and shared automatically. No cross-origin / third-party-cookie problems.
- **One persistent iframe.** The iframe is mounted once and kept alive. Menu switches navigate the v2 router via `postMessage` instead of changing the iframe `src`, so Angular 21 bootstraps only once.
- **Two-way URL sync.** The shell URL encodes the active v2 feature (`/v2/:feature`) so refresh, bookmarking, and the back button work. The v2 app reports its internal navigations back up to keep the shell URL in sync.
- **Typed, versioned message contract.** All shell↔iframe communication goes through a shared, validated message protocol — not ad-hoc `postMessage` calls.

## 3. Prerequisites & Assumptions

- Both apps are deployed behind the same nginx origin (same scheme, host, and port).
- The auth/session cookie is scoped to `path=/` so both apps receive it.
- New menus are primarily **content screens** (lists, forms, dashboards, wizards). Full-viewport overlays from v2 are the exception, not the rule (see Risk R1).
- The team can deploy the two apps independently.

## 4. Phased Implementation Plan

### Phase 0 — Foundations & Infrastructure

- [ ] Configure nginx to serve both apps from one origin with SPA fallback for each router.
- [ ] Build the v2 app with the correct base href.
- [ ] Confirm the auth cookie is `path=/` and reaches both apps.
- [ ] Verify no `X-Frame-Options: DENY` is sent for `/v2/`; set `frame-ancestors 'self'`.

nginx:

```nginx
location /v2/ {
    alias /var/www/v2/;
    try_files $uri $uri/ /v2/index.html;
    add_header Content-Security-Policy "frame-ancestors 'self'";
    # ensure NO `add_header X-Frame-Options DENY;` applies here
}

location / {
    root /var/www/root-app;
    try_files $uri $uri/ /index.html;
}

# Cache policy (see Phase 6)
location ~* \.[0-9a-f]{8,}\.(js|css)$ {   # hashed bundles
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location = /index.html      { add_header Cache-Control "no-cache"; }
location = /v2/index.html   { add_header Cache-Control "no-cache"; }
```

v2 build:

```bash
ng build --base-href /v2/
```

**Exit criteria:** visiting `/` loads the shell and `/v2/` loads the v2 app standalone; both share the logged-in session.

### Phase 1 — Basic Iframe Host

- [ ] Create a `V2HostComponent` in the shell that renders the iframe in the content area.
- [ ] Register a single parameterized route: `{ path: 'v2/:feature', component: V2HostComponent }`.
- [ ] Wire the new menu items to navigate to `/v2/<feature>`.
- [ ] Use a layout where the iframe fills the available content height (avoid `scrollHeight` syncing where possible).

**Exit criteria:** clicking a new menu item shows the corresponding v2 screen inside the shell.

### Phase 2 — Persistent Iframe + postMessage Navigation + URL Sync

- [ ] Keep the iframe mounted across menu switches (the `:feature` param reuses the same component instance).
- [ ] On `feature` param change, `postMessage` a navigation command to the iframe instead of reloading it.
- [ ] On the v2 side, listen for navigation commands and call `router.navigateByUrl()`.
- [ ] On v2 `NavigationEnd`, report the new route back so the shell updates its URL (`replaceUrl: true`).
- [ ] Implement a `ready` handshake so the shell does not message the iframe before Angular 21 has booted.

Shell host (`V2HostComponent`):

```ts
@Component({
  template: `<iframe #frame src="/v2/" title="New features"
              style="width:100%;height:100%;border:0;"></iframe>`
})
export class V2HostComponent implements OnInit, OnDestroy {
  @ViewChild('frame', { static: true }) frame!: ElementRef<HTMLIFrameElement>;
  private ready = false;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    window.addEventListener('message', this.onMessage);
    this.route.paramMap.subscribe(p => this.push(p.get('feature')!));
  }

  onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin) return;               // always validate origin
    switch (e.data?.type) {
      case 'v2:ready':
        this.ready = true;
        this.push(this.route.snapshot.paramMap.get('feature')!);
        break;
      case 'v2:navigated':
        this.router.navigate(['/v2', e.data.feature], { replaceUrl: true });
        break;
    }
  };

  push(feature: string) {
    if (!this.ready || !feature) return;
    this.frame.nativeElement.contentWindow!
      .postMessage({ type: 'shell:navigate', feature }, location.origin);
  }

  ngOnDestroy() { window.removeEventListener('message', this.onMessage); }
}
```

v2 app component:

```ts
constructor(private router: Router) {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'shell:navigate')
      this.router.navigateByUrl('/' + e.data.feature);
  });
  window.parent.postMessage({ type: 'v2:ready' }, location.origin);

  this.router.events.pipe(filter(e => e instanceof NavigationEnd))
    .subscribe((e: any) =>
      window.parent.postMessage(
        { type: 'v2:navigated', feature: e.urlAfterRedirects.split('/')[1] },
        location.origin));
}
```

**Exit criteria:** switching between v2 menus is instant (no re-bootstrap); refresh and the back button land on the correct v2 screen.

### Phase 3 — Authentication & Session Lifecycle *(highest priority)*

- [ ] Detect auth failure (401/403) inside the v2 app via an HTTP interceptor.
- [ ] On auth failure, `postMessage` `v2:auth-expired` to the shell — **do not** redirect to login inside the iframe.
- [ ] The shell handles `v2:auth-expired` with a **full-page** redirect to login.
- [ ] Propagate logout: logging out in either app tears down the other.
- [ ] Decide on token-refresh ownership (shell-driven refresh is simplest; v2 relies on the shared cookie).

```ts
// v2 HTTP interceptor (Angular 21)
catchError((err: HttpErrorResponse) => {
  if (err.status === 401 || err.status === 403)
    window.parent.postMessage({ type: 'v2:auth-expired' }, location.origin);
  return throwError(() => err);
});
```

```ts
// shell message handler
case 'v2:auth-expired':
  window.location.href = '/login?returnUrl=' + encodeURIComponent(location.pathname);
  break;
```

**Exit criteria:** session expiry while inside a v2 screen redirects the whole window to login; logout in one app logs out the other.

### Phase 4 — Loading, Error & Handshake Robustness

- [ ] Show a loading state (spinner/skeleton) in the shell from menu-click until `v2:ready`.
- [ ] Add a handshake **timeout** + retry in case the `ready` message races the listener or the iframe fails to boot.
- [ ] Detect iframe load failure (deploy mid-session, network blip) and show an error state with a retry/reload action.
- [ ] Handle rapid menu switching (debounce / latest-wins).

**Exit criteria:** a failed or slow v2 load produces a visible, recoverable UI state — never a silent blank frame.

### Phase 5 — Hardened Message Contract

- [ ] Create a small **shared TypeScript package** (or shared types file) defining all message types, imported by both apps.
- [ ] Add a **version** field to the contract; both apps check compatibility.
- [ ] Validate the shape of every incoming message; ignore unknown/malformed messages.
- [ ] Wrap raw `postMessage` calls in a typed message-bus helper on each side.

```ts
// shared/messages.ts  (imported by both apps)
export const PROTOCOL_VERSION = 1;
export type ShellToV2 = { v: number; type: 'shell:navigate'; feature: string };
export type V2ToShell =
  | { v: number; type: 'v2:ready' }
  | { v: number; type: 'v2:navigated'; feature: string }
  | { v: number; type: 'v2:auth-expired' };
```

**Exit criteria:** a shell talking to a mismatched v2 version degrades gracefully instead of breaking silently.

### Phase 6 — Deployment, Caching & Versioning

- [ ] Independent CI/CD pipelines for shell and v2.
- [ ] Cache-bust strategy: hashed assets `immutable`, both `index.html` files `no-cache` (see Phase 0 nginx).
- [ ] Define behavior under **version skew** (newer v2 loaded into an older shell session) — covered by the versioned contract in Phase 5.
- [ ] Smoke-test the integrated app in a staging environment that mirrors the nginx topology.

**Exit criteria:** deploying either app independently reaches users on next load without stale bundles or contract breakage.

### Phase 7 — Cross-Cutting Concerns

- [ ] **Observability:** error tracking (e.g. Sentry) in **both** apps; tag errors with which app/feature they came from.
- [ ] **Analytics:** fire page-view events on `postMessage` navigation — the shell's analytics will not see v2's router events automatically.
- [ ] **Accessibility:** move focus into the new content on menu switch; give the iframe a meaningful `title`; announce navigation to screen readers.
- [ ] **Visual consistency:** share a style baseline (fonts, colors, spacing, design tokens) so v2 content does not look bolted on.

### Phase 8 — Testing

- [ ] Unit tests for the message-bus, host component, and v2 message handlers.
- [ ] **E2E across the iframe boundary** — prefer **Playwright** (robust frame support) over Cypress (historically weak with iframes).
- [ ] E2E scenarios that specifically stress the boundary:
  - cold deep-link load (`/v2/reports` from a fresh tab)
  - session expiry while inside a v2 screen
  - rapid menu switching
  - back/forward navigation between legacy and v2 menus
  - iframe load failure / retry

**Exit criteria:** the boundary-crossing flows are covered by automated tests in CI.

### Phase 9 — Rollout

- [ ] Ship behind a feature flag; enable for internal users first.
- [ ] Monitor error rates and load failures for the v2 menus.
- [ ] Gradually expose to all users; keep a quick rollback path (flag off → menu items hidden).

## 5. Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | v2 modals/dropdowns/toasts are clipped to the iframe content area | Keep v2 menus content-only; render true full-screen overlays in the shell via a `postMessage` request; treat heavy overlay needs as the trigger to evaluate Native Federation |
| R2 | Session expiry shows login page inside the iframe | Phase 3 — v2 reports auth failure; shell does full-page redirect |
| R3 | Version skew between independently deployed apps | Phase 5 — versioned, validated message contract |
| R4 | Two Angular runtimes increase memory/load cost | Acceptable at 5–10 menus; single persistent iframe avoids repeated bootstraps |
| R5 | E2E tests can't reach iframe content | Use Playwright; cover boundary flows explicitly (Phase 8) |
| R6 | Stale bundles after deploy | Phase 6 cache headers (`no-cache` on index.html, immutable hashed assets) |

## 6. Production-Readiness Definition of Done

- [ ] Same-origin nginx topology live; session shared across both apps
- [ ] Single persistent iframe; instant menu switching with no re-bootstrap
- [ ] Two-way URL sync (refresh, bookmark, back button all correct)
- [ ] Session expiry & logout propagate correctly (full-page redirect, no in-iframe login)
- [ ] Loading + error + handshake-timeout states implemented
- [ ] Typed, versioned, validated message contract in a shared package
- [ ] Independent CI/CD with correct cache headers
- [ ] Error tracking + analytics wired in both apps
- [ ] Accessibility: focus management, iframe title
- [ ] Shared visual baseline
- [ ] Playwright e2e covering boundary-crossing flows
- [ ] Feature-flagged rollout with rollback path

## 7. Future Direction (Optional)

This iframe shell is a strangler-fig starting point. If the new menus increasingly need shared routing, shared chrome, or overlays that escape the content area, plan a migration to **Native Federation** (Angular 17+/esbuild) for the v2 app while keeping the same shell-owns-the-menu model. The same-origin topology, shared auth, and message-contract discipline established here carry over directly.

## 8. Indicative Sequencing

| Phase | Focus | Rough effort |
|-------|-------|--------------|
| 0–2 | Infra + working persistent-iframe navigation | Foundational; do first |
| 3–4 | Auth lifecycle + loading/error states | Critical for any real user |
| 5–6 | Contract hardening + deploy/cache | Before multi-team/parallel deploys |
| 7–8 | Observability, a11y, testing | Before go-live |
| 9 | Flagged rollout | Go-live |

> Phases 0–4 are the minimum for an internal beta. Phases 5–9 are the difference between "working" and "production ready."
