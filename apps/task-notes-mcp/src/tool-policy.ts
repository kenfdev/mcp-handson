export type ToolPolicy = {
  name: string;
  requiredScopes: string[];
  readOnly: boolean;
  destructive: boolean;
  sideEffect: "none" | "create" | "update" | "delete";
};

export const toolPolicies = {
  list_task_notes: {
    name: "list_task_notes",
    requiredScopes: ["task_notes:read"],
    readOnly: true,
    destructive: false,
    sideEffect: "none",
  },
  get_task_note: {
    name: "get_task_note",
    requiredScopes: ["task_notes:read"],
    readOnly: true,
    destructive: false,
    sideEffect: "none",
  },
} satisfies Record<string, ToolPolicy>;

export type ToolName = keyof typeof toolPolicies;
