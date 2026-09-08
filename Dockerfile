# Build on the NAS's Linux architecture. Never reuse Mac node_modules/.next.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# npm ci runs this package's postinstall to generate the icon manifest.
COPY scripts/copy-font-awesome.mjs ./scripts/copy-font-awesome.mjs
RUN npm ci
COPY . .
RUN npm run build \
    && test -f .next/standalone/server.js \
    && test -s .next/BUILD_ID \
    && rm -rf .next/standalone/data .next/standalone/scripts \
        .next/standalone/examples .next/standalone/.next/cache

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=America/Chicago

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/.next/BUILD_ID ./.next/BUILD_ID
COPY --from=build /app/public ./public
COPY --from=build /app/examples/config.json ./examples/config.json
COPY --from=build /app/scripts/init-family-hub.mjs ./scripts/init-family-hub.mjs
COPY --from=build /app/LICENSE ./LICENSE

# Only persistent application state and temporary Next.js cache are writable.
# upgrade.sh/systemd/git deployment helpers are deliberately absent.
RUN mkdir -p data public/backgrounds .next/cache \
    && chown -R node:node data public/backgrounds .next/cache \
    && chmod 700 data

USER node
EXPOSE 3000
# auth/status remains reachable when an imported IP allowlist is enabled.
# Validate its JSON shape without printing credentials or response bodies.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/auth/status',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)throw Error();const s=await r.json();if(typeof s.authEnabled!=='boolean'||typeof s.authenticated!=='boolean')throw Error()}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "umask 077 && node scripts/init-family-hub.mjs && exec node server.js"]
