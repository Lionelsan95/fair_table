FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain packages/domain
COPY apps/web apps/web
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile
ARG VITE_DEFAULT_LOCALE=fr
ENV VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
ARG VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron
ENV VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL
RUN pnpm --filter @fairtable/web build
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
