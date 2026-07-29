# Build static SPA, serve with nginx (minimal self-host)
FROM node:20-bookworm-slim AS build

RUN corepack enable

WORKDIR /app
COPY . .

# Same path as `make build` (workspace package @docxpdf/engine)
RUN cd apps/web && pnpm install --frozen-lockfile && pnpm build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
