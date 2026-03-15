# Base image
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies required for Prisma locally on Alpine
RUN apk add --no-cache openssl

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate prisma client
RUN npx prisma generate

# Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/index.js ./index.js
# Optional: copy other necessities if needed

EXPOSE 3001
CMD ["node", "index.js"]
