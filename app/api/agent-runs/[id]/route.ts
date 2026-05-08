import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { agentRunEvents, agentRuns } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { authUserOrDev } from "@/lib/dev-auth";
import { AGENT_RUN_STATUSES } from "@/lib/agent-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return authUserOrDev(user);
}

const PatchBody = z.object({
  status: z.enum(AGENT_RUN_STATUSES).optional(),
  summary: z.string().max(20000).optional().nullable(),
  branchName: z.string().max(300).optional().nullable(),
  worktreePath: z.string().max(1000).optional().nullable(),
  baseSha: z.string().max(100).optional().nullable(),
  headSha: z.string().max(100).optional().nullable(),
  previewUrl: z.string().url().optional().nullable(),
  productionUrl: z.string().url().optional().nullable(),
  vercelDeploymentUrl: z.string().url().optional().nullable(),
  changedFiles: z.array(z.string().max(1000)).max(500).optional().nullable(),
  checks: z.array(z.record(z.unknown())).max(100).optional().nullable(),
  lastError: z.string().max(20000).optional().nullable(),
  event: z
    .object({
      type: z.string().trim().min(1).max(120),
      body: z.string().max(20000).optional().nullable(),
      metadata: z.record(z.unknown()).optional().nullable(),
    })
    .optional(),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db
    .select()
    .from(agentRunEvents)
    .where(eq(agentRunEvents.runId, id))
    .orderBy(asc(agentRunEvents.createdAt));

  return NextResponse.json({ run, events });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const body = parsed.data;
  const terminal = ["completed", "failed", "rejected", "cancelled"].includes(
    body.status ?? "",
  );
  const now = new Date();
  const db = getDb();
  const [run] = await db
    .update(agentRuns)
    .set({
      ...(body.status ? { status: body.status } : {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
      ...(body.branchName !== undefined ? { branchName: body.branchName } : {}),
      ...(body.worktreePath !== undefined ? { worktreePath: body.worktreePath } : {}),
      ...(body.baseSha !== undefined ? { baseSha: body.baseSha } : {}),
      ...(body.headSha !== undefined ? { headSha: body.headSha } : {}),
      ...(body.previewUrl !== undefined ? { previewUrl: body.previewUrl } : {}),
      ...(body.productionUrl !== undefined ? { productionUrl: body.productionUrl } : {}),
      ...(body.vercelDeploymentUrl !== undefined
        ? { vercelDeploymentUrl: body.vercelDeploymentUrl }
        : {}),
      ...(body.changedFiles !== undefined ? { changedFilesJson: body.changedFiles } : {}),
      ...(body.checks !== undefined ? { checksJson: body.checks } : {}),
      ...(body.lastError !== undefined ? { lastError: body.lastError } : {}),
      ...(terminal ? { completedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(agentRuns.id, id))
    .returning();

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.event) {
    await db.insert(agentRunEvents).values({
      runId: id,
      eventType: body.event.type,
      body: body.event.body ?? null,
      metadataJson: body.event.metadata ?? null,
    });
  } else if (body.status) {
    await db.insert(agentRunEvents).values({
      runId: id,
      eventType: "status",
      body: `Status changed to ${body.status}.`,
      metadataJson: { status: body.status },
    });
  }

  return NextResponse.json({ run });
}
