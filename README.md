# DOCxPDF

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-5-FF3E00?logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8)](#features)

**Privacy-first visual document builder in the browser.** Drag text, images, shapes, and tables on a canvas; export to PDF, DOCX, HTML, or DXP. No account. Editing and storage stay on your device.

## Why

- **Client-side by default** — documents and images live in IndexedDB; nothing is required to leave the browser for normal editing and export.
- **Free forever** — core editor, templates, exports, and BYOK AI assist are ungated.
- **Bring your own key** — AI text assist and prompt → document use your provider keys (or local Ollama / LM Studio); keys stay in the browser.

## Features

- **Canvas editor** — multi-page layouts, zoom, multi-select, undo/redo, templates, tables, shapes
- **Import / export** — PDF (print), DOCX, HTML, DXP package, JSON; basic DOCX import
- **AI (BYOK)** — improve/write text elements; generate a full canvas document from a prompt; local usage history
- **PWA** — installable, offline-capable service worker
- **Page sizes** — A6–A3, B5, Letter, Legal, Executive, Tabloid

## Quick start

```bash
make dev        # install deps + SvelteKit dev server on :5173
make ci         # install → svelte-check → build → link check → tests
make build      # production build → apps/web/dist
make preview    # preview production build
```

Requirements: Node 20+, [pnpm](https://pnpm.io/), Make. Optional: Python 3 (link checker venv via `make tools`).

## Tech stack

SvelteKit 5 · TypeScript · Tailwind CSS · interact.js · JSZip · IndexedDB · Vitest · Playwright · Cloudflare Workers (static assets SPA)

## Project layout

```
.
├── Makefile                 # make dev / ci / build / deploy
├── package.json             # workspace root + wrangler
├── pnpm-workspace.yaml
├── wrangler.jsonc           # Cloudflare assets deploy
├── .github/                 # CI, E2E, coverage, Dependabot
├── apps/
│   └── web/                 # SvelteKit PWA
└── packages/
    └── engine/              # @docxpdf/engine shared document logic
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for workflows, tests, and gotchas.

```bash
make install        # pnpm install in apps/web
make svelte-check   # Svelte + TS validation
make test           # vitest (web)
make test-engine    # vitest (@docxpdf/engine)
make test-e2e       # Playwright
make coverage       # coverage report
make deploy         # build + wrangler deploy
make clean          # remove node_modules, dist, caches
```

Or from the app package:

```bash
cd apps/web && pnpm dev
cd apps/web && pnpm build
cd apps/web && pnpm exec vitest run
```

## Deploy

Output is a static SPA: `apps/web/dist` (SvelteKit `@sveltejs/adapter-static`).

### One-click (fork)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/prashant-shahi/docxpdf)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/prashant-shahi/docxpdf)

Config: `netlify.toml`, `vercel.json` (build `apps/web`, publish `apps/web/dist`).

### Cloudflare (maintainer / Wrangler)

Requires a logged-in [Wrangler](https://developers.cloudflare.com/workers/wrangler/) account:

```bash
make build
make deploy    # wrangler deploy (Workers static assets)
```

### Docker (self-host)

The image is **nginx + static files only** (no Node toolchain). Build the SPA first, then pack `apps/web/dist`:

```bash
make docker-build   # runs `make build`, then docker build
make docker-run     # http://localhost:8080
```

Or step by step:

```bash
make build
docker build -t docxpdf:local .
docker run --rm -p 8080:80 docxpdf:local
```

CI can run the same: install → `make build` → `docker build` / push. Runtime image stays small (~nginx alpine + assets).

### Any static host

```bash
make build
# upload apps/web/dist/  (enable SPA fallback to index.html)
```

## License

[Apache License 2.0](./LICENSE)
