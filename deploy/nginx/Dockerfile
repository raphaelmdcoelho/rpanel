FROM node:26-slim AS web
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace @rpanel/shared --workspace @rpanel/web --include-workspace-root=false \
 && npm run build -w @rpanel/shared && npm run build -w @rpanel/web

FROM nginx:1.27-alpine
COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /app/apps/web/dist /usr/share/nginx/html
