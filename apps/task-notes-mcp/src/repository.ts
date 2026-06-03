import type { TaskNote, TaskNotesDb, TaskStatus } from "./db.js";

export class TaskNotesRepository {
  constructor(private readonly db: TaskNotesDb) {}

  list(): TaskNote[] {
    return this.db.list();
  }

  get(id: number): TaskNote | undefined {
    return this.db.get(id);
  }

  create(input: { title: string; body: string }): TaskNote {
    return this.db.create(input);
  }

  updateStatus(id: number, status: TaskStatus): TaskNote | undefined {
    return this.db.updateStatus(id, status);
  }
}
