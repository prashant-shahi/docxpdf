# Copyright 2026 Prashant Shahi
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

WEB_DIR := apps/web
TOOLS_DIR := .tools
.PHONY: help ts svelte-check tools urls build install dev preview test test-e2e coverage ci clean deploy docker-build docker-run

help:
	@echo "╔═══════════════════════════════════════════════════════════════════════════╗"
	@echo "║  make ci                   Run ALL checks (installs deps first)           ║"
	@echo "║                                                                           ║"
	@echo "║  make ts                   TypeScript-only check (tsc --noEmit)           ║"
	@echo "║  make svelte-check         Svelte template + TypeScript validation        ║"
	@echo "║  make tools                Install/update CLI tools (via venv)            ║"
	@echo "║  make urls                 Check built HTML for broken links              ║"
	@echo "║  make build                Build SvelteKit web app                        ║"
	@echo "║  make dev                  Start SvelteKit dev server on :5173            ║"
	@echo "║  make preview              Start production preview on :4173              ║"
	@echo "║  make test                 Run vitest web app tests                      ║"
	@echo "║  make test-e2e             Run Playwright e2e tests                       ║"
	@echo "║  make coverage             Run tests with coverage report                 ║"
	@echo "║  make deploy               Build + deploy to Cloudflare Workers           ║"
	@echo "║  make docker-build         Build SPA then nginx-only Docker image         ║"
	@echo "║  make docker-run           Run container on http://localhost:8080         ║"
	@echo "║  make clean                Remove caches, node_modules, .tools/           ║"
	@echo "╚═══════════════════════════════════════════════════════════════════════════╝"

install:
	cd $(WEB_DIR) && pnpm install $(if $(CI),--frozen-lockfile,)

$(TOOLS_DIR)/venv:
	python3 -m venv $(TOOLS_DIR)/venv

$(TOOLS_DIR)/venv/bin/linkchecker: | $(TOOLS_DIR)/venv
	$(TOOLS_DIR)/venv/bin/pip install linkchecker

tools: | $(TOOLS_DIR)/venv
	@echo "Installing/updating tools..."
	$(TOOLS_DIR)/venv/bin/pip install --upgrade linkchecker

ts:
	cd $(WEB_DIR) && pnpm typecheck

svelte-check:
	cd $(WEB_DIR) && pnpm svelte-check

build: install
	cd $(WEB_DIR) && pnpm build

dev:
	cd $(WEB_DIR) && pnpm install && pnpm dev

preview: build
	cd $(WEB_DIR) && pnpm preview

urls: $(TOOLS_DIR)/venv/bin/linkchecker
	$(TOOLS_DIR)/venv/bin/linkchecker $(WEB_DIR)/dist/index.html

test:
	cd $(WEB_DIR) && pnpm exec vitest run

test-engine:
	cd packages/engine && pnpm install --no-frozen-lockfile && pnpm exec vitest run

test-e2e:
	cd $(WEB_DIR) && pnpm test:e2e

coverage-frontend: install
	cd $(WEB_DIR) && pnpm test:coverage

coverage: coverage-frontend

ci-frontend: install svelte-check build urls test test-engine
ci: ci-frontend

deploy: build
	pnpm exec wrangler deploy

# Image is nginx + apps/web/dist only (no Node). SPA is built on the host/CI first.
docker-build: build
	@test -f $(WEB_DIR)/dist/index.html || (echo "missing $(WEB_DIR)/dist — build failed?" && exit 1)
	docker build -t docxpdf:local .

docker-run: docker-build
	docker run --rm -p 8080:80 docxpdf:local

clean:
	rm -rf $(WEB_DIR)/node_modules $(WEB_DIR)/dist $(WEB_DIR)/.svelte-kit $(TOOLS_DIR) .wrangler
