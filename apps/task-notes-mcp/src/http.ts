import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { openDb } from "./db.js";
import { createTaskNotesMcpServer } from "./mcp-server.js";
import { TaskNotesRepository } from "./repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:./task-notes.http.db";
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3000");

const db = openDb(databaseUrl);
const repo = new TaskNotesRepository(db);

const httpServer = createServer(async (request, response) => {
  if (request.url === "/health" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/mcp") {
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
