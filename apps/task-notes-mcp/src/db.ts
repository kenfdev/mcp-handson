import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type TaskStatus = "open" | "done" | "archived";

export type TaskNote = {
  id: number;
  title: string;
  body: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

type TaskNotesData = {
  task_notes: TaskNote[];
  next_id: number;
};

export type TaskNotesDb = {
  list(): TaskNote[];
};

function seedData(): TaskNotesData {
  const now = new Date().toISOString();
  return {
    next_id: 3,
    task_notes: [
      {
        id: 1,
        title: "Read MCP authorization spec",
        body: "Focus on protected resource metadata and PKCE.",
        status: "open",
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        title: "Test MCP Inspector",
        body: "Verify tool discovery, schemas, and error handling.",
        status: "open",
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

export function openDb(databaseUrl: string): TaskNotesDb {
  const file = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(seedData(), null, 2));
  }

  return {
    list() {
      const data = JSON.parse(readFileSync(file, "utf8")) as TaskNotesData;
      return data.task_notes.slice().sort((a, b) => a.id - b.id);
    },
  };
}
