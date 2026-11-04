FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @rpanel/shared --workspace @rpanel/api --include-workspace-root=false \
 && npm run build -w @rpanel/shared && npm run build -w @rpanel/api

FROM node:26-slim
ENV NODE_ENV=production DATABASE_PATH=/data/rpanel.sqlite PORT=3000
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
RUN npm ci --omit=dev --workspace @rpanel/shared --workspace @rpanel/api --include-workspace-root=false
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
