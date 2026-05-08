import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims } from "@/db/schema";
import { DailyCleanResultsUpdate } from "@/components/updates/CleanResultsUpdate";
import {
  addDays,
  cleanResultFromClaim,
  dayKey,
  parseDayKey,
  startOfLocalDay,
} from "@/lib/update-results";

export const dynamic = "force-dynamic";

const ARCHIVE_DAYS = 60;

export default async function MentorDailyUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const now = new Date();
  const selectedDate = parseDayKey(params.date) ?? startOfLocalDay(now);
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
  const selectedKey = dayKey(selectedDate);

  return (
    <DailyCleanResultsUpdate
      results={allResults.filter((result) => dayKey(result.updatedAt) === selectedKey)}
      archive={allResults}
      selectedDate={selectedDate}
      generatedAt={now}
      dayPath="/mentor/updates"
      weekPath="/mentor/updates/week"
      showInternalLink={false}
    />
  );
}
