import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  litItemAnalyses,
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
  mode: z.enum(["answer", "answer_and_update"]).default("answer"),
});

type ChunkRow = {
  id: string;
  chunkIndex: number;
  text: string;
  sourceUrl: string | null;
};

type ContextPiece = {
  id: string;
  label: string;
  text: string;
  sourceUrl: string | null;
  chunkIndex: number | null;
};

type ItemPatch = {
  summary?: string;
  abstract?: string;
  tags?: string[];
};

type ModelResult = {
  answerMd: string;
  itemPatch?: ItemPatch;
  analysisMd?: string;
  updateRationale?: string;
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

function selectContext(chunks: ChunkRow[], question: string): ContextPiece[] {
  const terms = termsFor(question);
  const ranked =
    terms.length === 0
      ? chunks.slice(0, 8)
      : chunks
          .map((chunk) => {
            const text = chunk.text.toLowerCase();
            const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
            return { chunk, score };
          })
          .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
          .slice(0, 10)
          .map(({ chunk }) => chunk)
          .sort((a, b) => a.chunkIndex - b.chunkIndex);
  return ranked.map((chunk) => ({
    id: chunk.id,
    label: `chunk ${chunk.chunkIndex + 1}`,
    text: chunk.text,
    sourceUrl: chunk.sourceUrl,
    chunkIndex: chunk.chunkIndex,
  }));
}

function extractText(content: Anthropic.Messages.Message["content"]): string {
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function clampText(text: string, max = 18000): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

async function fetchText(url: string, label: string): Promise<ContextPiece | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5",
        "user-agent": "lit-review-dashboard/1.0",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (/application\/pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url)) {
      return {
        id: `external:${url}`,
        label,
        text: `PDF source is available at ${url}, but this dashboard route cannot extract PDF body text directly yet.`,
        sourceUrl: url,
        chunkIndex: null,
      };
    }
    const raw = await response.text();
    const text = contentType.includes("html") || raw.includes("<html") ? stripHtml(raw) : raw;
    const clamped = clampText(text);
    if (!clamped) return null;
    return { id: `external:${url}`, label, text: clamped, sourceUrl: url, chunkIndex: null };
  } catch {
    return null;
  }
}

async function fetchExternalContext(item: typeof litItems.$inferSelect): Promise<ContextPiece[]> {
  const out: ContextPiece[] = [];
  if (item.arxivId) {
    const arxiv = item.arxivId.replace(/^arxiv:/i, "");
    const piece = await fetchText(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxiv)}`,
      "arXiv metadata",
    );
    if (piece) out.push(piece);
  }

  const sourceUrl = item.url && !/\.pdf($|\?)/i.test(item.url) ? item.url : null;
  if (sourceUrl) {
    const piece = await fetchText(sourceUrl, "source page");
    if (piece) out.push(piece);
  }

  if (item.doi) {
    const piece = await fetchText(
      `https://api.crossref.org/works/${encodeURIComponent(item.doi)}`,
      "Crossref metadata",
    );
    if (piece) out.push(piece);
  }

  if (out.length === 0 && item.title) {
    const piece = await fetchText(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        item.title,
      )}&limit=3&fields=title,abstract,authors,year,venue,url,citationCount`,
      "Semantic Scholar search",
    );
    if (piece) out.push(piece);
  }

  return out;
}

function contextFromItem(
  item: typeof litItems.$inferSelect,
  analyses: Array<typeof litItemAnalyses.$inferSelect>,
  documents: Array<typeof litItemDocuments.$inferSelect>,
): ContextPiece[] {
  const pieces: ContextPiece[] = [
    {
      id: `item:${item.id}`,
      label: "item metadata",
      sourceUrl: item.url ?? item.pdfUrl ?? null,
      chunkIndex: null,
      text: [
        `Title: ${item.title}`,
        item.authorsJson?.length ? `Authors: ${item.authorsJson.join(", ")}` : "",
        item.abstract ? `Abstract: ${item.abstract}` : "",
        item.summary ? `Summary: ${item.summary}` : "",
        item.arxivId ? `arXiv: ${item.arxivId}` : "",
        item.doi ? `DOI: ${item.doi}` : "",
        item.url ? `URL: ${item.url}` : "",
        item.pdfUrl ? `PDF: ${item.pdfUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  for (const [index, analysis] of analyses.entries()) {
    const text = [analysis.tldr, analysis.analysisMd].filter(Boolean).join("\n\n");
    if (text.trim()) {
      pieces.push({
        id: `analysis:${analysis.id}`,
        label: `existing analysis ${index + 1}`,
        sourceUrl: analysis.sourcePath ?? null,
        chunkIndex: null,
        text: clampText(text, 14000),
      });
    }
  }

  for (const [index, document] of documents.entries()) {
    const text = document.textPlain ?? document.textMd;
    if (text?.trim()) {
      pieces.push({
        id: `document:${document.id}`,
        label: `document text ${index + 1}`,
        sourceUrl: document.sourceUrl,
        chunkIndex: null,
        text: clampText(text, 18000),
      });
    }
  }

  return pieces.filter((piece) => piece.text.trim());
}

function wantsUpdate(question: string, mode: z.infer<typeof Body>["mode"]): boolean {
  if (mode === "answer_and_update") return true;
  return /\b(update|modify|edit|revise|correct|add|save|write this back|change)\b/i.test(question);
}

function parseModelResult(text: string): ModelResult {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as Partial<ModelResult>;
    return { answerMd: String(parsed.answerMd ?? trimmed), ...parsed };
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Partial<ModelResult>;
        return { answerMd: String(parsed.answerMd ?? trimmed), ...parsed };
      } catch {
        // Fall through to plain text.
      }
    }
    return { answerMd: trimmed };
  }
}

function firstSentence(text: string, max = 280): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trim()}…`;
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

  const [chunks, analyses, documents] = await Promise.all([
    db
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
      .limit(400),
    db
      .select()
      .from(litItemAnalyses)
      .where(eq(litItemAnalyses.itemId, parsed.data.itemId))
      .orderBy(desc(litItemAnalyses.generatedAt), desc(litItemAnalyses.updatedAt))
      .limit(3),
    db
      .select()
      .from(litItemDocuments)
      .where(eq(litItemDocuments.itemId, parsed.data.itemId))
      .orderBy(desc(litItemDocuments.fetchedAt), desc(litItemDocuments.updatedAt))
      .limit(3),
  ]);

  const updateRequested = wantsUpdate(parsed.data.question, parsed.data.mode);
  const selectedFromChunks = selectContext(chunks, parsed.data.question);
  const fallbackContext =
    selectedFromChunks.length === 0 ? contextFromItem(item, analyses, documents) : [];
  const externalContext =
    updateRequested || selectedFromChunks.length === 0 ? await fetchExternalContext(item) : [];
  const selected = [...selectedFromChunks, ...fallbackContext, ...externalContext].slice(0, 12);
  let answerMd = "";
  let itemUpdated = false;
  const updatedFields: string[] = [];

  if (selected.length === 0) {
    answerMd =
      "I could not find extracted text, metadata, or fetchable source context for this item. The question was saved.";
  } else if (!process.env.ANTHROPIC_API_KEY) {
    answerMd =
      "Context is available, but ANTHROPIC_API_KEY is not configured for answering or updating. The question was saved.";
  } else {
    const context = selected
      .map((piece) => `[${piece.label}]\n${piece.text}`)
      .join("\n\n---\n\n");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: process.env.LIT_QA_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: updateRequested ? 2200 : 1400,
      temperature: 0,
      system:
        "Answer questions about a literature item using only the provided context. If the context is insufficient, say what is missing. Cite context labels like [chunk 3] or [source page]. Return strict JSON with keys: answerMd (markdown string), itemPatch (optional object with summary, abstract, tags), analysisMd (optional markdown string), updateRationale (optional string). Only include itemPatch/analysisMd when the user asked to update the item.",
      messages: [
        {
          role: "user",
          content: `Title: ${item.title}\nUpdate requested: ${updateRequested ? "yes" : "no"}\n\nQuestion: ${parsed.data.question}\n\nContext:\n${context}`,
        },
      ],
    });
    const result = parseModelResult(extractText(message.content) || "No answer was returned.");
    answerMd = result.answerMd || "No answer was returned.";

    if (updateRequested) {
      const now = new Date();
      const itemSet: Partial<typeof litItems.$inferInsert> = { updatedAt: now };
      const patch = result.itemPatch ?? {};
      if (patch.summary?.trim()) {
        itemSet.summary = patch.summary.trim();
        updatedFields.push("summary");
      }
      if (patch.abstract?.trim()) {
        itemSet.abstract = patch.abstract.trim();
        updatedFields.push("abstract");
      }
      if (patch.tags?.length) {
        const mergedTags = Array.from(
          new Set([...(item.tagsJson ?? []), ...patch.tags.map((tag) => tag.trim()).filter(Boolean)]),
        ).slice(0, 80);
        itemSet.tagsJson = mergedTags;
        updatedFields.push("tags");
      }
      if (updatedFields.length > 0) {
        await db.update(litItems).set(itemSet).where(eq(litItems.id, parsed.data.itemId));
        itemUpdated = true;
      }
      if (result.analysisMd?.trim()) {
        await db.insert(litItemAnalyses).values({
          externalId: `${item.externalId}:question-update:${Date.now()}`,
          itemId: parsed.data.itemId,
          analysisMd: result.analysisMd.trim(),
          tldr: firstSentence(answerMd),
          sourcePath: "dashboard:item-question",
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        updatedFields.push("analysis");
        itemUpdated = true;
      }
    }
  }

  const citations = selected.map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    sourceUrl: chunk.sourceUrl,
    label: chunk.label,
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

  return NextResponse.json({ ok: true, question: saved, itemUpdated, updatedFields });
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
