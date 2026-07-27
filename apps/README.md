# Applications

Monorepo layout for DOCxPDF applications.

| App | Path | Description |
|---|---|---|
| **Web** | [`web/`](web/) | SvelteKit browser app (PWA) — primary editor |
| **Engine** | [`../packages/engine/`](../packages/engine/) | `@docxpdf/engine` — templates, DOCX import, print HTML |

## Commands

```bash
make dev        # Web app on :5173
make ci         # Full CI pipeline
make deploy     # Build + Cloudflare Workers assets deploy
```

Tips use a Dodo **static payment link** (no server).
