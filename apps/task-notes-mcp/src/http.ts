import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { openDb } from "./db.js";
import { createTaskNotesMcpServer } from "./mcp-server.js";
import { TaskNotesRepository } from "./repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:./task-notes.http.db";
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3000");
const publicUrl = process.env.PUBLIC_URL ?? `http://${host}:${port}`;
const authIssuer = process.env.AUTH_ISSUER ?? "http://127.0.0.1:4000";

const db = openDb(databaseUrl);
const repo = new TaskNotesRepository(db);

function unauthorizedHeaders() {
  return {
    "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
  };
}

const httpServer = createServer(async (request, response) => {
  if (request.url === "/health" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/.well-known/oauth-protected-resource" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      resource: `${publicUrl}/mcp`,
      authorization_servers: [authIssuer],
      scopes_supported: ["task_notes:read", "task_notes:write"],
    }));
    return;
  }

  if (request.url === "/mcp") {
    if (!request.headers.authorization?.startsWith("Bearer ")) {
      response.writeHead(401, {
        "Content-Type": "application/json",
        ...unauthorizedHeaders(),
      });
      response.end(JSON.stringify({
        error: "unauthorized",
        message: "A valid bearer token is required.",
      }));
      return;
    }

    const mcpServer = createTaskNotesMcpServer(repo);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    response.on("close", () => {
      void transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(request, response);
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

httpServer.listen(port, host, () => {
  console.error(`task-notes-mcp HTTP server listening on http://${host}:${port}`);
});
