FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain packages/domain
COPY apps/api apps/api
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fairtable/api build
RUN pnpm --filter @fairtable/api --prod deploy --legacy /production
FROM node:24-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /production ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
