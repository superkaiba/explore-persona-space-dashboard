import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims } from "@/db/schema";
import { CleanResultsLogUpdate } from "@/components/updates/CleanResultsUpdate";
import {
  addDays,
  cleanResultFromClaim,
  startOfLocalDay,
} from "@/lib/update-results";

export const dynamic = "force-dynamic";

const ARCHIVE_DAYS = 60;

export default async function MentorDailyUpdatePage() {
  const db = getDb();
  const now = new Date();
  const archiveStart = addDays(startOfLocalDay(now), -ARCHIVE_DAYS);

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
    .where(and(eq(claims.status, "finalized"), gte(claims.updatedAt, archiveStart)))
    .orderBy(desc(claims.updatedAt));

  const allResults = claimRows.map(cleanResultFromClaim);

  return (
    <CleanResultsLogUpdate
      results={allResults}
      generatedAt={now}
      weekPath="/mentor/updates/week"
      showWeeklyLink={false}
      showInternalLink={false}
    />
  );
}
