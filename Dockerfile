FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Entrypoint: materialize BigQuery credentials from a Fly secret into the
# path the services expect (hard-coded in contest/portfolio/user services).
# No-op if GOOGLE_APPLICATION_CREDENTIALS_JSON is unset — the in-memory
# demo/test path doesn't need credentials.
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -e' \
  'if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then' \
  '  mkdir -p /app/src/GoogleCloudPlatform' \
  '  printf "%s" "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /app/src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json' \
  '  chmod 600 /app/src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json' \
  'fi' \
  'exec "$@"' \
  > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/server.js"]
