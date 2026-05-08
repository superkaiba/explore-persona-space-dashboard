import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  litItemDocumentChunks,
  litItemDocuments,
  litItemQuestions,
  litItems,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  itemId: z.string().uuid(),
  question: z.string().trim().min(1).max(20000),
});

type ChunkRow = {
  id: string;
  chunkIndex: number;
  text: string;
  sourceUrl: string | null;
};

function termsFor(question: string): string[] {
  const stop = new Set([
    "about",
    "after",
    "again",
    "also",
    "because",
    "before",
    "could",
    "does",
    "from",
    "have",
    "into",
    "paper",
    "that",
    "their",
    "there",
    "these",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
  ]);
  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !stop.has(term))
    .slice(0, 40);
}

function selectContext(chunks: ChunkRow[], question: string): ChunkRow[] {
  const terms = termsFor(question);
  if (terms.length === 0) return chunks.slice(0, 8);
  return chunks
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
    .slice(0, 10)
    .map(({ chunk }) => chunk)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

function extractText(content: Anthropic.Messages.Message["content"]): string {
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(litItems)
    .where(eq(litItems.id, parsed.data.itemId))
    .limit(1);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const chunks = await db
    .select({
      id: litItemDocumentChunks.id,
      chunkIndex: litItemDocumentChunks.chunkIndex,
      text: litItemDocumentChunks.text,
      sourceUrl: litItemDocuments.sourceUrl,
    })
    .from(litItemDocumentChunks)
    .innerJoin(litItemDocuments, eq(litItemDocuments.id, litItemDocumentChunks.documentId))
    .where(eq(litItemDocumentChunks.itemId, parsed.data.itemId))
    .orderBy(litItemDocumentChunks.chunkIndex)
    .limit(400);

  const selected = selectContext(chunks, parsed.data.question);
  let answerMd = "";

  if (selected.length === 0) {
    answerMd =
      "No extracted full text is available for this item yet. The question was saved.";
  } else if (!process.env.ANTHROPIC_API_KEY) {
    answerMd =
      "The extracted text is available, but ANTHROPIC_API_KEY is not configured for answering. The question was saved.";
  } else {
    const context = selected
      .map((chunk) => `[chunk ${chunk.chunkIndex + 1}]\n${chunk.text}`)
      .join("\n\n---\n\n");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: process.env.LIT_QA_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0,
      system:
        "Answer questions about a literature item using only the provided extracted text. If the text is insufficient, say what is missing. Cite chunks like [chunk 3]. Keep the answer concise and research-useful.",
      messages: [
        {
          role: "user",
          content: `Title: ${item.title}\n\nQuestion: ${parsed.data.question}\n\nExtracted text:\n${context}`,
        },
      ],
    });
    answerMd = extractText(message.content) || "No answer was returned.";
  }

  const citations = selected.map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    sourceUrl: chunk.sourceUrl,
  }));

  const [saved] = await db
    .insert(litItemQuestions)
    .values({
      itemId: parsed.data.itemId,
      question: parsed.data.question,
      answerMd,
      citationsJson: citations,
      userId: user.id,
      userEmail: user.email ?? null,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json({ ok: true, question: saved });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const questions = await getDb()
    .select()
    .from(litItemQuestions)
    .where(eq(litItemQuestions.itemId, itemId))
    .orderBy(desc(litItemQuestions.createdAt))
    .limit(50);

  return NextResponse.json({ ok: true, questions });
}
