import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { TaskNotesRepository } from "./repository.js";
import { toolPolicies } from "./tool-policy.js";

function asJsonText(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function notFound(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createTaskNotesMcpServer(repo: TaskNotesRepository) {
  const server = new McpServer({
    name: "task-notes-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "list_task_notes",
    {
      title: "List Task Notes",
      description: "List task notes. Requires task_notes:read. Read-only and side-effect free.",
      inputSchema: z.object({
        status: z.enum(["open", "done", "archived"]).optional().describe("Optional status filter"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      _meta: {
        policy: toolPolicies.list_task_notes,
      },
    },
    async ({ status }) => {
      const notes = repo.list().filter((note) => (status ? note.status === status : true));
      return asJsonText({ notes });
    },
  );

  server.registerTool(
    "get_task_note",
    {
      title: "Get Task Note",
      description: "Get one task note by id. Requires task_notes:read. Read-only and side-effect free.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Task note id"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      _meta: {
        policy: toolPolicies.get_task_note,
      },
    },
    async ({ id }) => {
      const note = repo.get(id);
      if (!note) return notFound(`Task note ${id} was not found.`);
      return asJsonText({ note });
    },
  );

  server.registerTool(
    "create_task_note",
    {
      title: "Create Task Note",
      description: "Create a task note. Requires task_notes:write. Creates durable data.",
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(4000),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      _meta: {
        policy: toolPolicies.create_task_note,
      },
    },
    async ({ title, body }) => {
      const note = repo.create({ title, body });
      return asJsonText({ note });
    },
  );

  return server;
}
