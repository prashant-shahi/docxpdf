# Runtime-only image: serve pre-built static SPA.
# Build artifacts first (local: `make build`, or CI), then:
#   docker build -t docxpdf .
FROM nginx:1.27-alpine

# Links GHCR package to this repo (https://docs.github.com/packages/learn-github-packages/connecting-a-repository-to-a-package)
LABEL org.opencontainers.image.source="https://github.com/prashant-shahi/docxpdf"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/dist /usr/share/nginx/html

EXPOSE 80
