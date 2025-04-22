FROM node:23-alpine

RUN npm i -g pnpm

WORKDIR /usr/src/app

COPY ./packages ./packages
COPY ./pnpm-lock.yaml ./pnpm-lock.yaml
COPY ./pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY ./package.json ./package.json
COPY ./turbo.json ./turbo.json

COPY ./apps/ws ./apps/ws

RUN pnpm install

EXPOSE 3001

CMD ["npm", "run", "start:ws"]
