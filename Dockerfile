FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# better-sqlite3 ships a binding.gyp, which makes npm try a source build even though the package
# already contains a prebuilt binary for every platform it supports. Nothing here needs a toolchain.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# better-sqlite3 ships a prebuilt binary per ABI and libc, so the runtime stage must install on the
# same base image the builder used rather than copying node_modules across.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
	PROTOCOL_HEADER=x-forwarded-proto \
	PACERR_CONFIG_DIR=/config \
	PACERR_LIBRARY_DIR=/library \
	PACERR_DOWNLOADS_DIR=/downloads \
	PORT=3000
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit dev --ignore-scripts
COPY --from=build /app/build ./build
COPY server.js ./
COPY src/lib/connection-protocol.ts ./src/lib/connection-protocol.ts
RUN mkdir -p /config /library /downloads && chown -R node:node /config /library /downloads
USER node
VOLUME ["/config", "/library", "/downloads"]
EXPOSE 3000
CMD ["node", "server.js"]
