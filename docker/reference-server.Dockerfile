FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/openport-core/package.json ./packages/openport-core/package.json
COPY packages/openport-core/tsconfig.json ./packages/openport-core/tsconfig.json
COPY packages/openport-core/src ./packages/openport-core/src
COPY apps/reference-server/package.json ./apps/reference-server/package.json
COPY apps/reference-server/tsconfig.json ./apps/reference-server/tsconfig.json
COPY apps/reference-server/src ./apps/reference-server/src

RUN npm --prefix packages/openport-core install
RUN npm --prefix apps/reference-server install
RUN npm --prefix packages/openport-core run build
RUN npm --prefix apps/reference-server run build

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "--prefix", "apps/reference-server", "run", "start"]
