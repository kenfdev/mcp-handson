import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  McpError,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { createDevelopmentAuthProvider, type AuthProvider } from "./auth.js";
import type { TaskStatus } from "./db.js";
import type { TaskNotesRepository } from "./repository.js";
import { toolPolicies, type ToolName } from "./tool-policy.js";

const TASK_NOTES_SUMMARY_URI = "task-notes://summary";

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

function taskNoteNotFound(id: number) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            error: {
              code: "TASK_NOTE_NOT_FOUND",
              message: `Task note ${id} was not found.`,
              details: {
                resource: "task_note",
                id,
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

async function authorize(auth: AuthProvider, toolName: ToolName) {
  await auth.requireToolScopes(toolName);
}

export function createTaskNotesMcpServer(
  repo: TaskNotesRepository,
  auth: AuthProvider = createDevelopmentAuthProvider(),
) {
  const server = new McpServer({
    name: "task-notes-mcp",
    version: "0.1.0",
  });
  const subscribedResourceUris = new Set<string>();

  async function notifyTaskNotesSummaryChanged() {
    if (!subscribedResourceUris.has(TASK_NOTES_SUMMARY_URI)) return;
    await server.server.sendResourceUpdated({ uri: TASK_NOTES_SUMMARY_URI });
  }

  server.registerResource(
    "task-notes-summary",
    TASK_NOTES_SUMMARY_URI,
    {
      title: "Task Notes Summary",
      description:
        "Read-only current task note counts grouped by status. Use this when answering questions about overall task progress or workload.",
      mimeType: "application/json",
    },
    async (uri) => {
      await authorize(auth, "list_task_notes");
      const notes = repo.list();
      const byStatus: Record<TaskStatus, number> = {
        open: 0,
        done: 0,
        archived: 0,
      };

      for (const note of notes) {
        byStatus[note.status] += 1;
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                summary: {
                  total: notes.length,
                  byStatus,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.server.registerCapabilities({
    resources: {
      subscribe: true,
    },
  });
  server.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    await authorize(auth, "list_task_notes");
    if (request.params.uri !== TASK_NOTES_SUMMARY_URI) {
      throw new McpError(ErrorCode.InvalidParams, `Resource ${request.params.uri} is not subscribable.`);
    }
    subscribedResourceUris.add(request.params.uri);
    return {};
  });
  server.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    subscribedResourceUris.delete(request.params.uri);
    return {};
  });

  server.registerPrompt(
    "review_task_notes",
    {
      title: "Review Task Notes",
      description:
        "Guide an assistant to review task note progress by reading the summary resource before using task note tools.",
      argsSchema: {
        focus: z.string().min(1).max(200).optional().describe("Optional review focus"),
      },
    },
    async ({ focus }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Review the current task notes for progress, risk, and next actions.",
              "",
              "Read task-notes://summary first to understand the overall status counts.",
              "Use list_task_notes only when the summary is not enough to answer the user's question.",
              "Use get_task_note when a specific note needs closer inspection.",
              "Do not create or update task notes unless the user explicitly asks for a change.",
              focus ? `Focus: ${focus}` : undefined,
            ].filter(Boolean).join("\n"),
          },
        },
      ],
    }),
  );

  server.registerTool(
    "list_task_notes",
    {
      title: "List Task Notes",
      description: "List task notes. Requires task_notes:read. Read-only and side-effect free.",
      inputSchema: z.object({
        status: z.enum(["open", "done", "archived"]).optional().describe("Optional status filter"),
        limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of notes to return"),
        offset: z.number().int().min(0).default(0).describe("Number of matching notes to skip"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      _meta: {
        policy: toolPolicies.list_task_notes,
      },
    },
    async ({ status, limit, offset }) => {
      await authorize(auth, "list_task_notes");
      const matchingNotes = repo.list().filter((note) => (status ? note.status === status : true));
      const notes = matchingNotes.slice(offset, offset + limit);
      return asJsonText({
        notes,
        page: {
          limit,
          offset,
          total: matchingNotes.length,
          hasMore: offset + limit < matchingNotes.length,
        },
      });
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
      await authorize(auth, "get_task_note");
      const note = repo.get(id);
      if (!note) return taskNoteNotFound(id);
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
      await authorize(auth, "create_task_note");
      const note = repo.create({ title, body });
      await notifyTaskNotesSummaryChanged();
      return asJsonText({ note });
    },
  );

  server.registerTool(
    "update_task_status",
    {
      title: "Update Task Status",
      description: "Update a task note status. Requires task_notes:write. Updates durable data.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Task note id"),
        status: z.enum(["open", "done", "archived"]),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      _meta: {
        policy: toolPolicies.update_task_status,
      },
    },
    async ({ id, status }: { id: number; status: TaskStatus }) => {
      await authorize(auth, "update_task_status");
      const note = repo.updateStatus(id, status);
      if (!note) return taskNoteNotFound(id);
      await notifyTaskNotesSummaryChanged();
      return asJsonText({ note });
    },
  );

  return server;
}
