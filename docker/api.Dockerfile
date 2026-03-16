FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/openport-product-contracts/package.json ./packages/openport-product-contracts/package.json
COPY packages/openport-product-contracts/tsconfig.json ./packages/openport-product-contracts/tsconfig.json
COPY packages/openport-product-contracts/src ./packages/openport-product-contracts/src
COPY packages/openport-core/package.json ./packages/openport-core/package.json
COPY packages/openport-core/tsconfig.json ./packages/openport-core/tsconfig.json
COPY packages/openport-core/src ./packages/openport-core/src
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/tsconfig.build.json ./apps/api/tsconfig.build.json
COPY apps/api/src ./apps/api/src

RUN npm --prefix packages/openport-product-contracts install
RUN npm --prefix packages/openport-core install
RUN npm --prefix apps/api install
RUN npm --prefix packages/openport-product-contracts run build
RUN npm --prefix packages/openport-core run build
RUN npm --prefix apps/api run build

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "--prefix", "apps/api", "run", "start"]
