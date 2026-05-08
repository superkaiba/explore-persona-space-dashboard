export const AGENT_RUN_MODES = [
  "clarify",
  "direct_apply",
] as const;

export type AgentRunMode = (typeof AGENT_RUN_MODES)[number];

export const AGENT_RUN_STATUSES = [
  "queued",
  "running",
  "awaiting_approval",
  "approved",
  "rejected",
  "deploying",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const AGENT_RUN_MODE_LABEL: Record<AgentRunMode, string> = {
  clarify: "Clarify",
  direct_apply: "Direct apply",
};

export const AGENT_RUN_MODE_HELP: Record<AgentRunMode, string> = {
  clarify: "Inspect and ask targeted questions before changing files.",
  direct_apply: "Edit the main checkout, verify, commit, push, and deploy Vercel.",
};

export const AGENT_RUN_STATUS_LABEL: Record<AgentRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  deploying: "Deploying",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function displayAgentRunMode(mode: string | null | undefined): string {
  if (!mode || !(mode in AGENT_RUN_MODE_LABEL)) return "Direct apply";
  return AGENT_RUN_MODE_LABEL[mode as AgentRunMode];
}

export function displayAgentRunStatus(status: string | null | undefined): string {
  if (!status || !(status in AGENT_RUN_STATUS_LABEL)) return "Queued";
  return AGENT_RUN_STATUS_LABEL[status as AgentRunStatus];
}
