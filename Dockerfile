# Alpine appears to be broken
ARG VERSION=20-bookworm-slim

FROM node:$VERSION

LABEL maintainer="juniorISO69960"

COPY . /app

RUN npm install typescript@latest -g && \
    cd /app && \
    npm install && \
    npm run build && \
    rm -rf src/ .idea/ .vscode/

WORKDIR /app

ENTRYPOINT ["node", "/app/dist/server/index.js"]