import type { TaskNote, TaskNotesDb } from "./db.js";

export class TaskNotesRepository {
  constructor(private readonly db: TaskNotesDb) {}

  list(): TaskNote[] {
    return this.db.list();
  }
}
