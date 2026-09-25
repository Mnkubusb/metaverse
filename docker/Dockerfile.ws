FROM node:22-alpine

# Prisma's query engine needs OpenSSL on Alpine
RUN apk add --no-cache openssl && npm i -g pnpm@9

WORKDIR /usr/src/app

COPY ./packages ./packages
COPY ./pnpm-lock.yaml ./pnpm-lock.yaml
COPY ./pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY ./package.json ./package.json
COPY ./turbo.json ./turbo.json

COPY ./apps/ws ./apps/ws

RUN pnpm install --frozen-lockfile \
 && pnpm db:generate \
 && pnpm --dir apps/ws run build

ENV NODE_ENV=production
EXPOSE 3001
USER node

# DATABASE_URL and JWT_SECRET come from the environment at `docker run`
CMD ["node", "apps/ws/dist/index.js"]
