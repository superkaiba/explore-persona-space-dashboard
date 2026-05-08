export type PersistedComment = {
  id: string;
  author: string;
  authorKind: string;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
};

export type ParsedComment = PersistedComment & {
  parentCommentId: string | null;
  anchorText: string | null;
  text: string;
  replies: ParsedComment[];
};

export function formatCommentBody({
  body,
  anchorText,
  parentCommentId,
}: {
  body: string;
  anchorText?: string | null;
  parentCommentId?: string | null;
}) {
  const lines: string[] = [];
  const parent = parentCommentId?.trim();
  const anchor = anchorText?.replace(/\s+/g, " ").trim();

  if (parent) lines.push(`Reply to: ${parent}`);
  if (anchor) lines.push("Comment on:", `> ${anchor}`);
  if (lines.length === 0) return body;
  return [...lines, "", body].join("\n");
}

export function parseCommentBody(body: string) {
  let rest = body.trim();
  let parentCommentId: string | null = null;
  let anchorText: string | null = null;

  const replyMatch = rest.match(/^Reply to:\s*([0-9a-f-]{8,})\s*\n+/i);
  if (replyMatch?.[1]) {
    parentCommentId = replyMatch[1];
    rest = rest.slice(replyMatch[0].length).trimStart();
  }

  const anchorMatch = rest.match(/^Comment on:\n> ([^\n]+)\n\n([\s\S]*)$/);
  if (anchorMatch) {
    anchorText = anchorMatch[1];
    rest = anchorMatch[2].trim();
  }

  return {
    parentCommentId,
    anchorText,
    text: rest,
  };
}

export function buildCommentTree(comments: PersistedComment[]): ParsedComment[] {
  const parsed = comments.map((comment) => ({
    ...comment,
    ...parseCommentBody(comment.body),
    replies: [] as ParsedComment[],
  }));
  const byId = new Map(parsed.map((comment) => [comment.id, comment]));
  const roots: ParsedComment[] = [];

  for (const comment of parsed) {
    const parent = comment.parentCommentId ? byId.get(comment.parentCommentId) : null;
    if (parent && parent.id !== comment.id) {
      parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}
