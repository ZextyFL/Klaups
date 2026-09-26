# Klaups TikTok LIVE worker — a persistent process, never a serverless function.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY tsconfig.json ./
# tsx is a runtime dependency here on purpose: no build step, so the image is
# identical to `npm start` locally.
CMD ["npx", "tsx", "src/index.ts"]
