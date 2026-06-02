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

  return server;
}
