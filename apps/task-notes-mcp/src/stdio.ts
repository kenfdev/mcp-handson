import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDb } from "./db.js";
import { createTaskNotesMcpServer } from "./mcp-server.js";
import { TaskNotesRepository } from "./repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:./task-notes.dev.db";
const db = openDb(databaseUrl);
const repo = new TaskNotesRepository(db);
const server = createTaskNotesMcpServer(repo);

const transport = new StdioServerTransport();
await server.connect(transport);
