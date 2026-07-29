# Runtime-only image: serve pre-built static SPA.
# Build artifacts first (local: `make build`, or CI), then:
#   docker build -t docxpdf .
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/dist /usr/share/nginx/html

EXPOSE 80
