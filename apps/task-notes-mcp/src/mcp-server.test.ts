import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tempDirs: string[] = [];

function firstTextContent(result: { content?: unknown }): string {
  const content = result.content;
  expect(Array.isArray(content)).toBe(true);
  const [first] = content as Array<{ type?: unknown; text?: unknown }>;
  expect(first?.type).toBe("text");
  expect(typeof first.text).toBe("string");
  return first.text as string;
}

async function createTempDatabaseUrl() {
  const dir = await mkdtemp(join(tmpdir(), "task-notes-mcp-test-"));
  tempDirs.push(dir);
  return `file:${join(dir, "task-notes.test.db")}`;
}

async function withMcpClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const appDir = resolve(import.meta.dirname, "..");
  const rootDir = resolve(appDir, "../..");
  const databaseUrl = await createTempDatabaseUrl();

  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["--filter", "task-notes-mcp", "dev:stdio"],
    cwd: rootDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "task-notes-mcp-test", version: "0.1.0" });
  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task-notes-mcp stdio contract", () => {
  it("exposes the expected read-only task note tools", async () => {
    await withMcpClient(async (client) => {
      const tools = await client.listTools();

      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "list_task_notes",
        "get_task_note",
      ]);

      const getTaskNote = tools.tools.find((tool) => tool.name === "get_task_note");
      expect(getTaskNote).toMatchObject({
        title: "Get Task Note",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
        },
        _meta: {
          policy: {
            requiredScopes: ["task_notes:read"],
            readOnly: true,
            destructive: false,
            sideEffect: "none",
          },
        },
      });
      expect(getTaskNote?.inputSchema).toMatchObject({
        type: "object",
        properties: {
          id: {
            type: "integer",
          },
        },
      });
    });
  });

  it("lists seeded task notes", async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "list_task_notes",
        arguments: {},
      });

      expect(result.isError).not.toBe(true);
      const payload = JSON.parse(firstTextContent(result)) as {
        notes: Array<{ id: number; title: string }>;
      };
      expect(payload.notes.map((note) => note.id)).toEqual([1, 2]);
    });
  });

  it("returns one task note by id", async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_task_note",
        arguments: { id: 1 },
      });

      expect(result.isError).not.toBe(true);
      const payload = JSON.parse(firstTextContent(result)) as {
        note: { id: number; title: string };
      };
      expect(payload.note).toMatchObject({
        id: 1,
        title: "Read MCP authorization spec",
      });
    });
  });

  it("returns a domain not-found error for a missing positive id", async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_task_note",
        arguments: { id: 9999 },
      });

      expect(result.isError).toBe(true);
      expect(firstTextContent(result)).toBe("Task note 9999 was not found.");
    });
  });

  it("returns an input validation error for an invalid id", async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_task_note",
        arguments: { id: -1 },
      });

      expect(result.isError).toBe(true);
      const text = firstTextContent(result);
      expect(text).toContain("MCP error -32602");
      expect(text).toContain("Input validation error");
    });
  });
});
