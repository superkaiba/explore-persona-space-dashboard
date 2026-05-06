import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { runTool, TOOLS } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClientMessage = { role: "user" | "assistant"; content: string };

const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_TURNS = 8;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { messages: ClientMessage[] };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages[] required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  // Internal multi-turn message history (with tool results)
  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          // Stream the model's reply for this turn
          let assistantContent: Anthropic.ContentBlock[] = [];
          let stopReason: string | null = null;

          const turnStream = client.messages.stream({
            model: MODEL,
            system: [
              { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            ],
            tools: TOOLS as unknown as Anthropic.Tool[],
            max_tokens: 2048,
            messages,
          });

          for await (const event of turnStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send("token", { text: event.delta.text });
            }
          }
          const final = await turnStream.finalMessage();
          assistantContent = final.content;
          stopReason = final.stop_reason;

          // If model used tools, run them and continue the loop
          const toolUses = assistantContent.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          messages.push({ role: "assistant", content: assistantContent });

          if (toolUses.length === 0 || stopReason !== "tool_use") {
            send("done", { stopReason });
            break;
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send("tool_use", { name: tu.name, input: tu.input });
            try {
              const result = await runTool(tu.name, tu.input as Record<string, unknown>);
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(result).slice(0, 32_000),
              });
              send("tool_result", { name: tu.name, ok: true });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ error: msg }),
                is_error: true,
              });
              send("tool_result", { name: tu.name, ok: false, error: msg });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
