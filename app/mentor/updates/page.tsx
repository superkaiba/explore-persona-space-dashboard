import { CleanResultsLogUpdate } from "@/components/updates/CleanResultsUpdate";
import { getMentorKanbanCleanResults } from "@/lib/github-kanban-results";

export const dynamic = "force-dynamic";

export default async function MentorDailyUpdatePage() {
  const now = new Date();
  const allResults = await getMentorKanbanCleanResults();

  return (
    <CleanResultsLogUpdate
      results={allResults}
      generatedAt={now}
      dateField="updatedAt"
      description="GitHub Useful and Not useful columns. Useful items are logged as done on Thu, May 7."
      weekPath="/mentor/updates/week"
      showWeeklyLink={false}
      showInternalLink={false}
    />
  );
}
