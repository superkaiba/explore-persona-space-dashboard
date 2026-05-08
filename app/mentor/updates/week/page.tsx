import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims } from "@/db/schema";
import { WeeklyCleanResultsUpdate } from "@/components/updates/CleanResultsUpdate";
import {
  addDays,
  cleanResultFromClaim,
  startOfLocalWeek,
} from "@/lib/update-results";

export const dynamic = "force-dynamic";

const RECENT_WEEKS = 8;

export default async function MentorWeeklyUpdatePage() {
  const db = getDb();
  const now = new Date();
  const weekStart = startOfLocalWeek(now);
  const recentStart = addDays(weekStart, -7 * (RECENT_WEEKS - 1));

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
    .where(and(eq(claims.status, "finalized"), gte(claims.updatedAt, recentStart)))
    .orderBy(desc(claims.updatedAt));

  const results = claimRows.map(cleanResultFromClaim);

  return (
    <WeeklyCleanResultsUpdate
      week={results.filter((result) => new Date(result.updatedAt).getTime() >= weekStart.getTime())}
      recent={results.filter((result) => new Date(result.updatedAt).getTime() < weekStart.getTime())}
      generatedAt={now}
      weekStart={weekStart}
      dayPath="/mentor/updates"
    />
  );
}
