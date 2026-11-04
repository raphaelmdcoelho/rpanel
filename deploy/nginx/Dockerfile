FROM node:26-slim AS web
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web apps/web
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace @rpanel/web --include-workspace-root=false && npm run build -w @rpanel/web

FROM nginx:1.27-alpine
COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /app/apps/web/dist /usr/share/nginx/html
