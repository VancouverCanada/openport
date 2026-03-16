FROM node:20-bookworm-slim

WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/openport-product-contracts/package.json ./packages/openport-product-contracts/package.json
COPY packages/openport-product-contracts/tsconfig.json ./packages/openport-product-contracts/tsconfig.json
COPY packages/openport-product-contracts/src ./packages/openport-product-contracts/src
COPY apps/web/package.json ./apps/web/package.json
COPY apps/web/package-lock.json ./apps/web/package-lock.json
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY apps/web/next-env.d.ts ./apps/web/next-env.d.ts
COPY apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY apps/web/public ./apps/web/public
COPY apps/web/src ./apps/web/src

RUN npm --prefix packages/openport-product-contracts install
RUN npm --prefix apps/web ci
RUN npm --prefix packages/openport-product-contracts run build
RUN npm --prefix apps/web run build

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "--prefix", "apps/web", "run", "start"]
