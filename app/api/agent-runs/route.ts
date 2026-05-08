import { NextResponse, type NextRequest } from "next/server";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { agentRunEvents, agentRuns } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { authUserOrDev } from "@/lib/dev-auth";
import { AGENT_RUN_MODES, AGENT_RUN_PROVIDERS } from "@/lib/agent-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return authUserOrDev(user);
}

const CreateBody = z.object({
  mode: z.enum(AGENT_RUN_MODES),
  provider: z.enum(AGENT_RUN_PROVIDERS).optional(),
  sandboxPreview: z.boolean().optional(),
  request: z.string().trim().min(1).max(12000),
  chatSessionId: z.string().uuid().optional().nullable(),
  productionUrl: z.string().url().optional().nullable(),
});

function productionUrlFromEnv() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://dashboard.superkaiba.com"
  );
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb()
    .select({
      id: agentRuns.id,
      mode: agentRuns.mode,
      provider: agentRuns.provider,
      status: agentRuns.status,
      request: agentRuns.request,
      summary: agentRuns.summary,
      chatSessionId: agentRuns.chatSessionId,
      previewUrl: agentRuns.previewUrl,
      productionUrl: agentRuns.productionUrl,
      vercelDeploymentUrl: agentRuns.vercelDeploymentUrl,
      lastError: agentRuns.lastError,
      createdAt: agentRuns.createdAt,
      updatedAt: agentRuns.updatedAt,
      completedAt: agentRuns.completedAt,
      eventCount: sql<number>`(SELECT count(*)::int FROM agent_run_event WHERE run_id = ${agentRuns.id})`,
    })
    .from(agentRuns)
    .orderBy(desc(agentRuns.updatedAt))
    .limit(50);

  return NextResponse.json({ runs: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const now = new Date();
  const body = parsed.data;
  const db = getDb();
  const [run] = await db
    .insert(agentRuns)
    .values({
      mode: body.mode,
      provider: body.provider ?? "claude_code",
      sandboxPreview: body.sandboxPreview ?? false,
      status: "running",
      request: body.request,
      chatSessionId: body.chatSessionId ?? null,
      productionUrl: body.productionUrl ?? productionUrlFromEnv(),
      createdByUserId: user.id,
      createdByUserEmail: user.email ?? null,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(agentRunEvents).values({
    runId: run.id,
    eventType: "created",
    body: `Started ${body.mode} agent run.`,
    metadataJson: {
      mode: body.mode,
      provider: body.provider ?? "claude_code",
      sandboxPreview: body.sandboxPreview ?? false,
      chatSessionId: body.chatSessionId ?? null,
    },
  });

  return NextResponse.json({ run });
}
