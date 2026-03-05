FROM node:alpine

RUN apk add --no-cache git
RUN npm install -g pnpm
RUN git clone https://tangled.org/pds.ls/pdsls /build

WORKDIR /build

RUN sed -i "s|pdsls.dev|${APP_DOMAIN}|g" public/oauth-client-metadata.json
RUN pnpm install
RUN pnpm build

COPY /build/dist/* /app/

ENV APP_DOMAIN="pdsls.northsky.social"
ENV APP_PROTOCOL="https"

VOLUME /app
