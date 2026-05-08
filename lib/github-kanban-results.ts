import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims } from "@/db/schema";
import {
  cleanResultFromClaim,
  type CleanResult,
  type CleanResultConfidence,
  markdownExcerpt,
} from "@/lib/update-results";

const PROJECT_URL =
  process.env.GITHUB_RESULTS_PROJECT_URL ?? "https://github.com/users/superkaiba/projects/1";
const REPO_PATH =
  process.env.GITHUB_RESULTS_REPO ?? "superkaiba/explore-persona-space";

type GitHubKanbanResultIssue = {
  number: number;
  title: string;
  useful: boolean;
  statusName: "Useful" | "Not useful";
  createdAt: string;
  updatedAt: string;
  url: string;
};

type MemexColumn = {
  id: string;
  name: string;
  settings?: {
    options?: Array<{
      id: string;
      name: string;
    }>;
  } | null;
};

type MemexItemsPayload = {
  nodes?: MemexItem[];
};

type MemexItem = {
  contentType?: string;
  issueCreatedAt?: string;
  updatedAt?: string;
  memexProjectColumnValues?: Array<{
    memexProjectColumnId?: string;
    value?: unknown;
  }>;
  content?: {
    url?: string;
  } | null;
};

type MemexTitleValue = {
  title?: {
    raw?: string;
  };
  number?: number;
};

export async function getMentorKanbanCleanResults(): Promise<CleanResult[]> {
  const issues = await getGitHubKanbanResultIssues();
  if (issues.length === 0) return [];

  const issueNumbers = issues.map((issue) => issue.number);
  const db = getDb();
  const claimRows = await db
    .select({
      id: claims.id,
      title: claims.title,
      confidence: claims.confidence,
      githubIssueNumber: claims.githubIssueNumber,
      bodyJson: claims.bodyJson,
      createdAt: claims.createdAt,
      updatedAt: claims.updatedAt,
    })
    .from(claims)
    .where(inArray(claims.githubIssueNumber, issueNumbers));

  const claimByIssue = new Map(
    claimRows
      .filter((claim) => claim.githubIssueNumber != null)
      .map((claim) => [claim.githubIssueNumber as number, claim]),
  );

  return issues.map((issue) => {
    const claim = claimByIssue.get(issue.number);
    if (!claim) return cleanResultFromKanbanIssue(issue);

    const result = cleanResultFromClaim({
      ...claim,
      title: issue.title || claim.title,
      createdAt: issue.createdAt,
    });

    return {
      ...result,
      title: issue.title || result.title,
      useful: issue.useful,
      createdAt: issue.createdAt,
    };
  });
}

async function getGitHubKanbanResultIssues(): Promise<GitHubKanbanResultIssue[]> {
  const response = await fetch(PROJECT_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "eps-dashboard",
    },
  });

  if (!response.ok) {
    console.warn(`GitHub project fetch failed: ${response.status} ${response.statusText}`);
    return [];
  }

  const html = await response.text();
  const columns = readScriptJson<MemexColumn[]>(html, "memex-columns-data") ?? [];
  const payload = readScriptJson<MemexItemsPayload>(html, "memex-paginated-items-data");
  const statusOptions = new Map<string, string>();

  for (const column of columns) {
    if (column.id !== "Status") continue;
    for (const option of column.settings?.options ?? []) {
      statusOptions.set(option.id, option.name);
    }
  }

  const byNumber = new Map<number, GitHubKanbanResultIssue>();
  for (const item of payload?.nodes ?? []) {
    const issue = kanbanIssueFromItem(item, statusOptions);
    if (!issue) continue;
    byNumber.set(issue.number, issue);
  }

  return Array.from(byNumber.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function kanbanIssueFromItem(
  item: MemexItem,
  statusOptions: Map<string, string>,
): GitHubKanbanResultIssue | null {
  if (item.contentType !== "Issue") return null;
  const url = item.content?.url ?? "";
  if (!url.includes(`/${REPO_PATH}/issues/`)) return null;

  const titleValue = item.memexProjectColumnValues?.find(
    (value) => value.memexProjectColumnId === "Title",
  )?.value as MemexTitleValue | undefined;
  const statusValue = item.memexProjectColumnValues?.find(
    (value) => value.memexProjectColumnId === "Status",
  )?.value as { id?: string } | undefined;

  const statusName = statusValue?.id ? statusOptions.get(statusValue.id) : null;
  if (statusName !== "Useful" && statusName !== "Not useful") return null;

  const number = titleValue?.number ?? issueNumberFromUrl(url);
  const title = titleValue?.title?.raw;
  const createdAt = item.issueCreatedAt;
  if (!number || !title || !createdAt) return null;

  return {
    number,
    title,
    useful: statusName === "Useful",
    statusName,
    createdAt,
    updatedAt: item.updatedAt ?? createdAt,
    url,
  };
}

function cleanResultFromKanbanIssue(issue: GitHubKanbanResultIssue): CleanResult {
  const body = [
    `GitHub issue #${issue.number} is in the ${issue.statusName} column of the GitHub project board.`,
    "",
    issue.url,
  ].join("\n");

  return {
    id: `github-issue-${issue.number}`,
    title: issue.title,
    body,
    excerpt: markdownExcerpt(body),
    confidence: confidenceFromTitle(issue.title),
    useful: issue.useful,
    githubIssueNumber: issue.number,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    href: issue.url,
  };
}

function readScriptJson<T>(html: string, id: string): T | null {
  const pattern = new RegExp(
    `<script type="application/json" id="${escapeRegExp(id)}">([\\s\\S]*?)<\\/script>`,
  );
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch (error) {
    console.warn(`Could not parse GitHub project payload ${id}:`, error);
    return null;
  }
}

function issueNumberFromUrl(url: string) {
  const match = url.match(/\/issues\/(\d+)(?:$|[/?#])/);
  return match?.[1] ? Number(match[1]) : null;
}

function confidenceFromTitle(title: string): CleanResultConfidence {
  const match = title.match(/\b(HIGH|MODERATE|LOW)\s+confidence\b/i);
  return match?.[1] ? (match[1].toUpperCase() as CleanResultConfidence) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
