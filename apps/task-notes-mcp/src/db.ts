import Database from "better-sqlite3";

export type TaskStatus = "open" | "done" | "archived";

export type TaskNote = {
  id: number;
  title: string;
  body: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export type TaskNotesDb = {
  list(): TaskNote[];
};

function seedData(db: Database.Database) {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    insert into task_notes (title, body, status, created_at, updated_at)
    values (?, ?, ?, ?, ?)
  `);

  insert.run("Read MCP authorization spec", "Focus on protected resource metadata and PKCE.", "open", now, now);
  insert.run("Test MCP Inspector", "Verify tool discovery, schemas, and error handling.", "open", now, now);
}

export function openDb(databaseUrl: string): TaskNotesDb {
  const file = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  const db = new Database(file);
  db.pragma("journal_mode = WAL");

  db.exec(`
    create table if not exists task_notes (
      id integer primary key autoincrement,
      title text not null,
      body text not null,
      status text not null check (status in ('open', 'done', 'archived')),
      created_at text not null,
      updated_at text not null
    );
  `);

  const count = db.prepare("select count(*) as count from task_notes").get() as { count: number };
  if (count.count === 0) {
    seedData(db);
  }

  return {
    list() {
      return db.prepare(`
        select id, title, body, status, created_at, updated_at
        from task_notes
        order by id asc
      `).all() as TaskNote[];
    },
  };
}
