import { WeeklyCleanResultsUpdate } from "@/components/updates/CleanResultsUpdate";
import { getMentorKanbanCleanResults } from "@/lib/github-kanban-results";
import { addDays, asDate, startOfLocalWeek } from "@/lib/update-results";

export const dynamic = "force-dynamic";

const RECENT_WEEKS = 8;

export default async function MentorWeeklyUpdatePage() {
  const now = new Date();
  const weekStart = startOfLocalWeek(now);
  const recentStart = addDays(weekStart, -7 * (RECENT_WEEKS - 1));

  const results = (await getMentorKanbanCleanResults()).filter(
    (result) => asDate(result.createdAt).getTime() >= recentStart.getTime(),
  );

  return (
    <WeeklyCleanResultsUpdate
      week={results.filter((result) => asDate(result.createdAt).getTime() >= weekStart.getTime())}
      recent={results.filter((result) => asDate(result.createdAt).getTime() < weekStart.getTime())}
      generatedAt={now}
      weekStart={weekStart}
      dateField="createdAt"
      dayPath="/mentor/updates"
    />
  );
}
