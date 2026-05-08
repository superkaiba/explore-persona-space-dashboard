import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { projects } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/lit";

export const runtime = "nodejs";

const Body = z.object({
  title: z.string().trim().min(1).max(500),
  status: z.string().trim().min(1).max(100).default("active"),
  summary: z.string().trim().max(5000).optional().nullable(),
  public: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const body = parsed.data;
  const now = new Date();
  const baseSlug = slugify(body.title);
  const slug = `${baseSlug}-${now.getTime().toString(36)}`;
  const [project] = await getDb()
    .insert(projects)
    .values({
      title: body.title,
      slug,
      status: body.status,
      summary: body.summary || null,
      public: body.public,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ project });
}
