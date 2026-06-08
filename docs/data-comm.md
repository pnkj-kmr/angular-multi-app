# Shell ⇄ v2 Data Communication

How the two Angular apps in this workspace exchange data:

- **Shell** — Angular 14, the top window. Hosts the legacy menus and embeds v2.
- **v2 app** — Angular 21, runs inside an `<iframe>` (`/v2-app/`).

They are **separate applications in separate browser documents** and cannot call
each other's code or share memory. The only bridge between them is the browser's
`window.postMessage` API.

## The channel: `window.postMessage`

```
┌─────────────────────────── Shell (Angular 14, top window) ──────────────────────────┐
│  V2HostComponent                                                                      │
│    frame.contentWindow.postMessage(msg)  ───────────┐   (shell → iframe)             │
│    window.addEventListener('message', …)  ◀───────┐ │                                │
│                                                   │ │                                 │
│   ┌──────────────── <iframe src="/v2-app/"> ──────┼─▼──────────────────────────────┐ │
│   │  v2 app (Angular 21)                          │                                 │ │
│   │    V2BridgeService                            │                                 │ │
│   │      window.parent.postMessage(msg)  ─────────┘   (iframe → shell)              │ │
│   │      window.addEventListener('message', …) ◀──────                              │ │
│   └─────────────────────────────────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────────────────────────────────────┘
```

| Direction | Sender | Code |
|---|---|---|
| Shell → iframe | `V2HostComponent` | `this.frame.nativeElement.contentWindow?.postMessage(msg, location.origin)` (`ui/src/app/v2-host/v2-host.component.ts`) |
| iframe → shell | `V2BridgeService` | `window.parent.postMessage(msg, location.origin)` (`ui_oss/src/app/v2-bridge.service.ts`) |

Each side **listens** with `window.addEventListener('message', …)`.

## The data: a typed message contract

The payload is not arbitrary — it is a small set of typed messages defined in
`shared/messages.ts`. The file is **framework-free and duplicated verbatim** in
both apps (`ui_oss/src/app/shared/messages.ts` and `ui/src/app/shared/messages.ts`)
so each app compiles independently. In production this should become a single
shared package. Keep the two copies in sync and bump `PROTOCOL_VERSION` on any
breaking change.

| Direction | Message | Carries | Meaning |
|---|---|---|---|
| iframe → shell | `v2:ready` | `protocolVersion` | "I've booted, you can talk to me now" |
| shell → iframe | `shell:navigate` | `feature` (e.g. `"settings"`) | "Show this screen" |
| iframe → shell | `v2:navigated` | `feature` | "I navigated internally to this screen" |
| iframe → shell | `v2:auth-expired` | — | "Got a 401/403, log the user out" |

Every message carries `v: PROTOCOL_VERSION` so a version mismatch can be detected
and ignored.

## The full handshake & data flow

Walking through a click on **New Settings**:

1. **Handshake.** The iframe boots; `V2BridgeService.start()` fires `v2:ready`
   up, retried every 300ms until the shell answers. This solves the race where
   the iframe is ready before the shell's `message` listener is attached.
2. **`onFrameLoad`.** The iframe's `(load)` handler in `v2-host.component.html`
   fires when the iframe *document* finishes loading. It carries no data — it
   just (re)arms an 8-second timeout so that if `v2:ready` never arrives, the
   host shows the error/retry overlay. It is a liveness check, not part of the
   message channel.
3. **Shell drives the screen.** On receiving `v2:ready`, the shell sends
   `shell:navigate { feature: "settings" }` down.
4. **iframe routes.** `V2BridgeService.onMessage` receives it and calls
   `router.navigateByUrl('/settings')` — the v2 app shows the Settings screen.
5. **iframe reports back.** Later in-app navigations inside v2 send
   `v2:navigated { feature }` up, so the shell can mirror its own URL to
   `/v2/<feature>` for refresh / bookmark / back-button support.

## Three things that make it safe

- **Origin validation.** Both listeners reject any message whose
  `e.origin !== location.origin`. This is why the apps are served
  **same-origin** (via the nginx / dev proxy setup) — cross-origin postMessage
  would be a security hole here. The send side also passes `location.origin` as
  the target, so a message is only delivered to a same-origin frame.
- **Type guards.** `isShellToV2` / `isV2ToShell` validate the shape of `e.data`
  before trusting it — anything malformed is silently dropped. `postMessage` can
  deliver junk from anywhere, so it is never trusted blind.
- **Zone re-entry.** `postMessage` callbacks run *outside* Angular's zone, so
  Angular would not notice the state change. Both sides wrap the handling in
  `this.zone.run(() => …)` so change detection and routing actually fire.

## URL synchronization & loop prevention

The shell URL (`/v2/:feature`) and the v2 router are **two independent routers
kept in sync over the message wire**. Without guards, each side's navigation
echoes to the other and bounces back, producing a rapid volley of History API
calls that trips the browser's *"Too many calls to Location or History APIs
within a short timeframe"* throttle.

The guards that break the loop:

- **`V2BridgeService.lastFeatureFromShell`** — when the iframe navigates because
  of a `shell:navigate`, the resulting `NavigationEnd` is *not* echoed back up.
  Only navigations that originate **inside** v2 are reported.
- **`V2BridgeService.shellHasNavigated`** — the iframe stays silent until the
  shell sends its first `shell:navigate`. While embedded, the shell owns the
  initial screen, so the iframe's own bootstrap redirect (`'' → dashboard`) must
  not be reported up; otherwise it overwrites the URL the user actually
  navigated to (e.g. `/v2/settings` gets clobbered to `/v2/dashboard`).
- **`V2HostComponent.lastFeatureFromV2`** — when the shell mirrors a
  `v2:navigated` into its own URL, the resulting `paramMap` change is not pushed
  back down to the iframe.
- **`V2HostComponent.lastSentFeature`** — the shell never re-pushes the feature
  the iframe is already showing. It is cleared in `retry()` because a reloaded
  iframe resets to its default screen.

## Key mental model

The two apps **never share memory or call each other's functions**. They
exchange **serializable messages** — the object is structured-cloned across the
frame boundary, so no functions, class instances, or DOM nodes can cross. It is
effectively a tiny network protocol between two programs that happen to live in
the same browser tab. That is also why the URL sync needs explicit guards:
there are genuinely two independent routers being kept in sync over a message
wire, not one shared router.
