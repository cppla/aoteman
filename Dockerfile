FROM nginx:1.30.4-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY public/ /usr/share/nginx/html/

# Nginx writes its PID and temporary files only under the /tmp tmpfs.
USER nginx
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

# Bypass image entrypoint scripts that try to rewrite a read-only /etc/nginx.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
