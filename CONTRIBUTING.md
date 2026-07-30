# Contributing

Thanks for helping improve DOCxPDF. This guide covers local setup, checks, and a few non-obvious constraints.

## Setup

Requirements: Node 20+, [pnpm](https://pnpm.io/), Make. Optional: Python 3 for the link checker (`make tools`).

```bash
make dev        # install deps + dev server on :5173
make ci         # full local CI: install → svelte-check → build → links → tests
```

Prefer `make` targets so local runs match CI.

## Checks

```bash
make svelte-check   # Svelte + TypeScript
make test           # vitest (apps/web)
make test-engine    # vitest (@docxpdf/engine)
make test-e2e       # Playwright
make coverage       # coverage report
make urls           # link check on built HTML (needs build + tools venv)
```

Before opening a PR, `make ci` should pass.

## Layout

| Path | Role |
|------|------|
| `apps/web/` | SvelteKit PWA (UI, routes, client storage) |
| `packages/engine/` | Shared document model / engine logic |
| `Makefile` | Install, test, build, deploy entry points |
| `.github/workflows/` | CI, E2E, coverage |

## Print / PDF zoom (important)

PDF export uses the browser print pipeline. In `apps/web/src/app.css`, `@media print` sets `zoom: 1.33` on **`html` only** so output matches physical page sizes (96 DPI screen → 72 DPI PostScript).

**Do not change that value casually** — wrong zoom breaks A4/Letter alignment in exported PDFs.

**Do not also set `zoom` on `body`** — nested zoom compounds in Chromium (~1.77×), overflows `@page`, and produces a blank second sheet.

## Secrets and local files

Do not commit:

- `.env`, `.dev.vars`, `private.pem`, or API keys
- `node_modules/`, `dist/`, `.svelte-kit/`, `.tools/`, `.wrangler/`

These are covered by `.gitignore`.

## Pull requests

- Keep changes focused; prefer small PRs when possible.
- Use conventional commit style when it fits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`).
- Describe what changed and how you verified it (`make ci`, targeted tests, manual check).

## Developer Certificate of Origin (DCO)

There is **no CLA**. Every commit **must** include a [DCO](https://developercertificate.org/) sign-off:

```bash
git commit -s -m "feat: your change"
```

That adds:

```
Signed-off-by: Your Name <your.email@example.com>
```

It certifies you wrote the change (or have the right to submit it) under this project’s license. `-s` uses your `user.name` and `user.email` (prefer the same identity as on GitHub).

Auto-append sign-off in a local clone:

```bash
git config core.hooksPath .githooks
```

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](./LICENSE) and that your commits are DCO-signed (`git commit -s`).
