"use client";

import { useState, useTransition } from "react";

type SavedQuestion = {
  id: string;
  question: string;
  answerMd: string | null;
  createdAt: string | Date;
};

export function ItemQuestionForm({
  itemId,
  initialQuestions,
  hasFullText,
}: {
  itemId: string;
  initialQuestions: SavedQuestion[];
  hasFullText: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState(initialQuestions);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = question.trim();
    if (!trimmed || isPending) return;
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/lit/item-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, question: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.question) {
        setError(data?.error ?? "Could not save question");
        return;
      }
      setQuestions((current) => [data.question, ...current]);
      setQuestion("");
    });
  }

  return (
    <section className="rounded-md border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-semibold tracking-tight">Ask this item</h2>
        <span className="text-[10px] font-medium text-muted">
          {hasFullText ? "full text" : "no text yet"}
        </span>
      </div>
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        className="min-h-24 w-full resize-y rounded-md border border-border bg-canvas p-2 text-[12px] leading-relaxed outline-none focus:border-muted"
        placeholder="Ask a question..."
      />
      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !question.trim()}
        className="mt-2 rounded-md border border-border bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Answering..." : "Ask and save"}
      </button>
      {questions.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {questions.map((saved) => (
            <div key={saved.id} className="rounded-md border border-border bg-canvas p-3">
              <p className="text-[12px] font-medium leading-relaxed">{saved.question}</p>
              {saved.answerMd && (
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
                  {saved.answerMd}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
