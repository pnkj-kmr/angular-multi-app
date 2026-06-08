# angular-multi-app

Embedding a new **Angular 21** app (`ui_oss`) inside an existing **Angular 14** shell
(`ui`) via a single, persistent, **same-origin iframe**. Full design rationale in
[docs/app1.md](docs/app1.md).

```
nginx (one origin)
 ├── /          → ui      (Angular 14 shell — owns menu, chrome, auth, routing,
 │                         and the user-facing /v2/:feature URLs)
 └── /v2-app/   → ui_oss  (Angular 21 app — the new menus, loaded in one iframe)
```

> The static v2 app lives at **`/v2-app/`** (what the iframe loads), separate from
> the shell's user-facing **`/v2/:feature`** route. This separation is what makes a
> refresh of `/v2/reports` load the *shell* (which mounts the iframe) rather than the
> v2 app standalone.

- **One persistent iframe.** Mounted once. Switching v2 menus sends a `shell:navigate`
  `postMessage` instead of reloading `src`, so Angular 21 bootstraps only once.
- **Two-way URL sync.** Shell URL `/v2/:feature` ↔ v2 router, via the message contract
  in `*/src/app/shared/messages.ts` (duplicated in both apps; make it a shared package
  in production).
- **Auth:** v2 never shows login in the iframe — a 401/403 emits `v2:auth-expired` and
  the shell does a full-page redirect.

## Toolchain

The two apps need different Node versions:

| App      | Angular | Node            |
|----------|---------|-----------------|
| `ui`     | 14      | 16 (`nvm use 16`) |
| `ui_oss` | 21      | 20+ (`nvm use 20`) |

## Run it (production-like, recommended)

This exercises the real same-origin design through nginx.

```bash
# 1. Build the v2 app (baseHref /v2-app/ is set in ui_oss/angular.json)
cd ui_oss && nvm use 20 && npx ng build --output-path dist/ui_oss

# 2. Build the shell
cd ../ui && nvm use 16 && npx ng build

# 3. Serve both builds through nginx. deploy/nginx.local.conf already points at the
#    two dist/ folders by absolute path (no symlinks needed):
nginx -c "$PWD/../deploy/nginx.local.conf"
# open http://localhost:8099   (stop with: nginx -c ... -s stop)
```

(`deploy/nginx.conf` is the production template using `/var/www/...` roots.)

## Run it (dev mode, hot reload)

The shell dev-server proxies `/v2` to the v2 dev-server, so the browser still sees a
single origin (`http://localhost:4200`).

```bash
# Terminal 1 — v2 app, served under /v2-app/  (--serve-path sets the base path).
# --host 127.0.0.1 forces IPv4 so the shell's proxy can reach it (the Angular 21
# dev server otherwise binds IPv6 [::1] only, which the proxy can't connect to).
cd ui_oss && nvm use 20 && npx ng serve --port 4300 --host 127.0.0.1 --serve-path /v2-app

# Terminal 2 — shell (proxies /v2-app → :4300, see ui/proxy.conf.json)
cd ui && nvm use 16 && npx ng serve
# open http://localhost:4200
```

Either way: click a **New (v2)** menu item in the sidebar — the v2 screen loads in the
iframe, the URL becomes `/v2/<feature>`, and switching between v2 menus is instant
(no re-bootstrap). Refresh and back/forward land on the correct screen.
