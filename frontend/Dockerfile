FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

FROM oven/bun:1

WORKDIR /app

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["bun", "x", "serve", "-s", "dist", "-l", "5173"]