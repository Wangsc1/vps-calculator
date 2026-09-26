FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="VPS Value" \
      org.opencontainers.image.description="VPS 剩余价值计算器（纯静态）" \
      org.opencontainers.image.source="https://github.com/Wangsc1/vps-calculator" \
      org.opencontainers.image.licenses="Apache-2.0"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js style.css icon.svg manifest.webmanifest LICENSE NOTICE /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
