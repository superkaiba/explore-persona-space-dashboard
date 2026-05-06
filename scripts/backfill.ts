/**
 * Backfill Supabase from GitHub issues:
 *   - clean-results-labeled issues   -> claim rows + figure (hero) + edges (derives_from)
 *   - in-progress status:* issues    -> experiment rows (with mapped status enum)
 *   - status:proposed open issues    -> todo rows
 *
 * Where the body has "Parent: #N" or a "## Source issues" section, we wire
 * a `derives_from` edge from todo/experiment -> claim.
 *
 * Idempotent: re-running upserts on github_issue_number unique key.
 */

import { execSync } from "node:child_process";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set in dashboard/.env.local");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 5 });

interface GhLabel {
  name: string;
}
interface GhIssue {
  number: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  state?: string;
  labels?: GhLabel[];
}

function gh<T = GhIssue[]>(args: string[]): T {
  const out = execSync(["gh", ...args].join(" "), {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  return JSON.parse(out) as T;
}

function parseConfidence(title: string): "HIGH" | "MODERATE" | "LOW" | null {
  const m = title.match(/\((HIGH|MODERATE|LOW)\s+confidence\)\s*$/i);
  return m ? (m[1].toUpperCase() as "HIGH" | "MODERATE" | "LOW") : null;
}
function stripConfidenceSuffix(title: string): string {
  return title.replace(/\s*\((HIGH|MODERATE|LOW)\s+confidence\)\s*$/i, "").trim();
}
function parseHeroFigure(body: string): string | null {
  const lower = body.toLowerCase();
  const idx = lower.indexOf("### results");
  const start = idx >= 0 ? idx : 0;
  const m = body.slice(start).match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  return m ? m[1] : null;
}
function parseSourceIssueRefs(body: string): number[] {
  const head = body.match(/##\s+Source issues/i);
  if (!head) return [];
  const start = body.indexOf(head[0]) + head[0].length;
  const after = body.slice(start);
  const next = after.match(/\n##\s/);
  const section = next ? after.slice(0, next.index) : after;
  const nums = new Set<number>();
  for (const m of section.matchAll(/#(\d{1,6})\b/g)) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) nums.add(n);
  }
  return [...nums];
}

/** Best-effort parent-issue extractor. Tries explicit markers first, falls back to first #N in the lead-in. */
function parseParentRef(body: string): number | null {
  if (!body) return null;
  const explicitPatterns: RegExp[] = [
    /^\s*Parent:\s*#(\d{1,6})/im,
    /Follow[-\s]?up\s+(?:to|from|of)\s+(?:clean[-\s]?result\s+)?#(\d{1,6})/i,
    /Follow[-\s]?up\s+from\s+#(\d{1,6})/i,
    /^\s*Source(?:s)?:\s*#(\d{1,6})/im,
    /supersedes\s+#(\d{1,6})/i,
    /builds?\s+on\s+#(\d{1,6})/i,
  ];
  for (const re of explicitPatterns) {
    const m = body.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  // Fallback: first #N in the first 800 chars (often appears in opening Context/Motivation prose).
  const lead = body.slice(0, 800);
  const fallback = lead.match(/#(\d{1,6})/);
  if (fallback) {
    const n = parseInt(fallback[1], 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

const IN_PROGRESS_LABELS = new Set([
  "status:planning",
  "status:plan-pending",
  "status:approved",
  "status:implementing",
  "status:code-reviewing",
  "status:running",
  "status:uploading",
  "status:interpreting",
  "status:reviewing",
  "status:awaiting-promotion",
]);
function statusLabelToEnum(label: string): string {
  return label.replace(/^status:/, "").replace(/-/g, "_");
}

async function findEntityByIssue(num: number): Promise<{ kind: "claim" | "experiment"; id: string } | null> {
  const claims = await sql<{ id: string }[]>`
    SELECT id FROM claim WHERE github_issue_number = ${num} LIMIT 1
  `;
  if (claims[0]) return { kind: "claim", id: claims[0].id };
  const exps = await sql<{ id: string }[]>`
    SELECT id FROM experiment WHERE github_issue_number = ${num} LIMIT 1
  `;
  if (exps[0]) return { kind: "experiment", id: exps[0].id };
  return null;
}

async function backfillClaims() {
  const issues = gh<GhIssue[]>([
    "issue", "list",
    "--repo", "superkaiba/explore-persona-space",
    "--label", "clean-results",
    "--state", "all",
    "--limit", "200",
    "--json", "number,title,body,createdAt,updatedAt,state",
  ]);
  console.log(`📥  ${issues.length} clean-results issues`);

  const claimByIssue = new Map<number, string>();

  for (const iss of issues) {
    const confidence = parseConfidence(iss.title);
    const title = stripConfidenceSuffix(iss.title);
    const body = iss.body ?? "";
    const bodyJson = { kind: "markdown", text: body };

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO claim (title, confidence, status, body_json, github_issue_number, created_at, updated_at)
      VALUES (${title}, ${confidence}, ${"finalized"}, ${sql.json(bodyJson)}, ${iss.number}, ${iss.createdAt}, ${iss.updatedAt})
      ON CONFLICT (github_issue_number) DO UPDATE SET
        title = EXCLUDED.title,
        confidence = EXCLUDED.confidence,
        body_json = EXCLUDED.body_json,
        updated_at = EXCLUDED.updated_at
      RETURNING id
    `;
    claimByIssue.set(iss.number, row.id);

    const heroUrl = parseHeroFigure(body);
    if (heroUrl) {
      const [fig] = await sql<{ id: string }[]>`
        INSERT INTO figure (url, caption, entity_kind, entity_id)
        VALUES (${heroUrl}, ${"hero (auto-extracted)"}, ${"claim"}, ${row.id})
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      if (fig) {
        await sql`UPDATE claim SET hero_figure_id = ${fig.id} WHERE id = ${row.id}`;
      }
    }
  }

  console.log(`✅ ${claimByIssue.size} claims upserted`);

  let edgeCount = 0;
  for (const iss of issues) {
    const fromId = claimByIssue.get(iss.number);
    if (!fromId) continue;
    for (const ref of parseSourceIssueRefs(iss.body ?? "")) {
      const toId = claimByIssue.get(ref);
      if (!toId || toId === fromId) continue;
      await sql`
        INSERT INTO edge (from_kind, from_id, to_kind, to_id, type)
        VALUES (${"claim"}, ${fromId}, ${"claim"}, ${toId}, ${"derives_from"})
        ON CONFLICT DO NOTHING
      `;
      edgeCount++;
    }
  }
  console.log(`✅ ${edgeCount} claim→claim derives_from edges`);
}

async function backfillExperiments() {
  const issues = gh<GhIssue[]>([
    "issue", "list",
    "--repo", "superkaiba/explore-persona-space",
    "--state", "open",
    "--limit", "500",
    "--json", "number,title,body,createdAt,updatedAt,labels",
  ]);

  const inProgress = issues.filter((iss) => {
    const labels = (iss.labels ?? []).map((l) => l.name);
    if (labels.includes("clean-results")) return false;
    return labels.some((l) => IN_PROGRESS_LABELS.has(l));
  });
  console.log(`📥  ${inProgress.length} in-progress experiments`);

  let count = 0;
  let edgeCount = 0;
  for (const iss of inProgress) {
    const labels = (iss.labels ?? []).map((l) => l.name);
    const statusLabel = labels.find((l) => IN_PROGRESS_LABELS.has(l)) ?? "status:running";
    const status = statusLabelToEnum(statusLabel);
    const parentRef = parseParentRef(iss.body ?? "");
    const parent = parentRef ? await findEntityByIssue(parentRef) : null;
    const claimId = parent?.kind === "claim" ? parent.id : null;
    const planJson = { kind: "markdown", text: iss.body ?? "" };

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO experiment (title, status, plan_json, github_issue_number, claim_id, created_at, updated_at)
      VALUES (${iss.title}, ${status}::experiment_status, ${sql.json(planJson)}, ${iss.number}, ${claimId}, ${iss.createdAt}, ${iss.updatedAt})
      ON CONFLICT (github_issue_number) DO UPDATE SET
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        plan_json = EXCLUDED.plan_json,
        claim_id = EXCLUDED.claim_id,
        updated_at = EXCLUDED.updated_at
      RETURNING id
    `;
    count++;

    if (parent) {
      await sql`
        INSERT INTO edge (from_kind, from_id, to_kind, to_id, type)
        VALUES (${"experiment"}, ${row.id}, ${parent.kind}, ${parent.id}, ${"derives_from"})
        ON CONFLICT DO NOTHING
      `;
      edgeCount++;
    }
  }
  console.log(`✅ ${count} experiments · ${edgeCount} experiment→parent edges`);
}

async function backfillTodosAndUntriaged() {
  // One query for all open issues, then split client-side by labels.
  const issues = gh<GhIssue[]>([
    "issue", "list",
    "--repo", "superkaiba/explore-persona-space",
    "--state", "open",
    "--limit", "500",
    "--json", "number,title,body,createdAt,updatedAt,labels",
  ]);

  const allStatusLabels = new Set([
    "status:proposed",
    ...IN_PROGRESS_LABELS,
    "status:done-experiment",
    "status:done-impl",
    "status:blocked",
    "status:archived",
  ]);

  const proposed: GhIssue[] = [];
  const untriaged: GhIssue[] = [];
  for (const iss of issues) {
    const labels = (iss.labels ?? []).map((l) => l.name);
    if (labels.includes("clean-results")) continue;
    if (labels.includes("status:proposed")) proposed.push(iss);
    else if (!labels.some((l) => allStatusLabels.has(l))) untriaged.push(iss);
  }
  console.log(`📥  ${proposed.length} proposed · ${untriaged.length} untriaged`);

  let count = 0;
  let edgeCount = 0;
  for (const [kind, group] of [
    ["proposed", proposed],
    ["untriaged", untriaged],
  ] as const) {
    for (const iss of group) {
      const text = `#${iss.number} — ${iss.title}`;
      const parentRef = parseParentRef(iss.body ?? "");
      const parent = parentRef ? await findEntityByIssue(parentRef) : null;

      const [row] = await sql<{ id: string }[]>`
        INSERT INTO todo (text, status, kind, github_issue_number, linked_kind, linked_id, created_at)
        VALUES (${text}, ${"open"}, ${kind}, ${iss.number}, ${parent?.kind ?? null}, ${parent?.id ?? null}, ${iss.createdAt})
        ON CONFLICT (github_issue_number) DO UPDATE SET
          text = EXCLUDED.text,
          kind = EXCLUDED.kind,
          linked_kind = EXCLUDED.linked_kind,
          linked_id = EXCLUDED.linked_id
        RETURNING id
      `;
      count++;
      if (parent) {
        await sql`
          INSERT INTO edge (from_kind, from_id, to_kind, to_id, type)
          VALUES (${"todo"}, ${row.id}, ${parent.kind}, ${parent.id}, ${"derives_from"})
          ON CONFLICT DO NOTHING
        `;
        edgeCount++;
      }
    }
  }
  console.log(`✅ ${count} todos · ${edgeCount} todo→parent edges`);
}

(async () => {
  try {
    await backfillClaims();
    await backfillExperiments();
    await backfillTodosAndUntriaged();
    console.log("\n🎉 backfill complete");
  } catch (e) {
    console.error("backfill failed:", e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
