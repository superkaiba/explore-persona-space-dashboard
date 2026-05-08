export const TASK_STATUSES = [
  "inbox",
  "scoped",
  "planning",
  "open",
  "in_progress",
  "running",
  "interpreting",
  "awaiting_promotion",
  "blocked",
  "done",
  "cancelled",
  "archived",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_INTENT_MODES = [
  "exploratory",
  "hypothesis",
  "replication",
  "measurement",
  "engineering",
] as const;

export type TaskIntentMode = (typeof TASK_INTENT_MODES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  inbox: "Inbox",
  scoped: "Scoped",
  planning: "Planning",
  open: "Inbox",
  in_progress: "Running",
  running: "Running",
  interpreting: "Interpreting",
  awaiting_promotion: "Awaiting promotion",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const TASK_INTENT_LABEL: Record<TaskIntentMode, string> = {
  exploratory: "Exploratory",
  hypothesis: "Hypothesis",
  replication: "Replication",
  measurement: "Measurement",
  engineering: "Engineering",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "inbox",
  "scoped",
  "planning",
  "running",
  "interpreting",
  "awaiting_promotion",
  "blocked",
  "done",
  "cancelled",
  "archived",
];

export function displayTaskStatus(status: string | null | undefined): string {
  if (!status || !(status in TASK_STATUS_LABEL)) return "Inbox";
  return TASK_STATUS_LABEL[status as TaskStatus];
}

export function displayIntentMode(mode: string | null | undefined): string {
  if (!mode || !(mode in TASK_INTENT_LABEL)) return "Exploratory";
  return TASK_INTENT_LABEL[mode as TaskIntentMode];
}

export function displayPriority(priority: string | null | undefined): string {
  if (!priority || !(priority in TASK_PRIORITY_LABEL)) return "Normal";
  return TASK_PRIORITY_LABEL[priority as TaskPriority];
}
