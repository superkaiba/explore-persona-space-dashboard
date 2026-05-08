export const LIT_ITEM_TYPES = [
  "paper",
  "blog_post",
  "forum_post",
  "newsletter",
  "report",
  "repo",
  "video",
  "other",
] as const;

export const LIT_READ_STATUSES = ["unread", "skimmed", "read"] as const;

export const LIT_RELATION_TYPES = [
  "supports",
  "contradicts",
  "method",
  "baseline",
  "background",
  "threat",
  "inspiration",
] as const;

export const LIT_LINK_STATUSES = ["proposed", "accepted", "rejected"] as const;
export const LIT_LINK_SOURCES = ["auto", "manual"] as const;
export const RESEARCH_IDEA_STATUSES = [
  "seed",
  "active",
  "paused",
  "developed",
  "abandoned",
] as const;

export type LitItemType = (typeof LIT_ITEM_TYPES)[number];
export type LitReadStatus = (typeof LIT_READ_STATUSES)[number];
export type LitRelationType = (typeof LIT_RELATION_TYPES)[number];
export type LitLinkStatus = (typeof LIT_LINK_STATUSES)[number];
export type ResearchIdeaStatus = (typeof RESEARCH_IDEA_STATUSES)[number];

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "research-idea";
}

export function formatLitDate(value: Date | string | null | undefined): string {
  if (!value) return "undated";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatLitType(type: string | null | undefined): string {
  if (type === "other" || type === "report") return "General topic";
  if (["blog_post", "forum_post", "newsletter", "repo", "video"].includes(type ?? "")) {
    return "Blog post";
  }
  if (!type) return "Item";
  return type
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatReadStatus(status: LitReadStatus | string | null | undefined): string {
  if (status === "skimmed") return "Skimmed";
  if (status === "read") return "Read";
  return "Unread";
}
