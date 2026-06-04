FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/task-notes-mcp/package.json apps/task-notes-mcp/package.json
COPY apps/local-auth-server/package.json apps/local-auth-server/package.json
RUN pnpm install --frozen-lockfile

COPY apps/task-notes-mcp apps/task-notes-mcp
RUN pnpm --filter task-notes-mcp build

WORKDIR /app/apps/task-notes-mcp
EXPOSE 3000

CMD ["node", "dist/http.js"]
