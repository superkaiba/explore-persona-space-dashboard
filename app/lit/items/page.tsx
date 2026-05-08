import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { litItemStates, litItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  formatLitDate,
  formatLitType,
  formatReadStatus,
  LIT_READ_STATUSES,
  type LitItemType,
  type LitReadStatus,
} from "@/lib/lit";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ItemRow = {
  id: string;
  title: string;
  type: string;
  source: string | null;
  sourceDetail: string | null;
  authorsJson: string[] | null;
  publishedAt: Date | null;
  discoveredAt: Date;
  summary: string | null;
  readStatus?: LitReadStatus | null;
  archived?: boolean | null;
};

const TYPE_FILTERS: Array<{ value: LitItemType; label: string }> = [
  { value: "paper", label: "Papers" },
  { value: "blog_post", label: "Blog posts" },
  { value: "other", label: "General topics" },
];
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bucketForType(type: string): LitItemType {
  if (type === "paper") return "paper";
  if (type === "other" || type === "report") return "other";
  return "blog_post";
}

function isNewRow(row: ItemRow): boolean {
  if (row.source === "manual_reading_list") return false;
  if ((row.readStatus ?? "unread") !== "unread") return false;
  return Date.now() - row.discoveredAt.getTime() <= NEW_WINDOW_MS;
}

export default async function LitItemsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const statusParam = first(params.status);
  const typeParam = first(params.type);
  const selectedStatus = LIT_READ_STATUSES.includes(statusParam as LitReadStatus)
    ? (statusParam as LitReadStatus)
    : null;
  const selectedType = TYPE_FILTERS.some((filter) => filter.value === typeParam)
    ? (typeParam as LitItemType)
    : null;

  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows: ItemRow[] = user
    ? await db
        .select({
          id: litItems.id,
          title: litItems.title,
          type: litItems.type,
          source: litItems.source,
          sourceDetail: litItems.sourceDetail,
          authorsJson: litItems.authorsJson,
          publishedAt: litItems.publishedAt,
          discoveredAt: litItems.discoveredAt,
          summary: litItems.summary,
          readStatus: litItemStates.readStatus,
          archived: litItemStates.archived,
        })
        .from(litItems)
        .leftJoin(
          litItemStates,
          and(eq(litItemStates.itemId, litItems.id), eq(litItemStates.userId, user.id)),
        )
        .where(undefined)
        .orderBy(desc(sql`coalesce(${litItems.publishedAt}, ${litItems.discoveredAt})`))
        .limit(200)
    : await db
        .select({
          id: litItems.id,
          title: litItems.title,
          type: litItems.type,
          source: litItems.source,
          sourceDetail: litItems.sourceDetail,
          authorsJson: litItems.authorsJson,
          publishedAt: litItems.publishedAt,
          discoveredAt: litItems.discoveredAt,
          summary: litItems.summary,
        })
        .from(litItems)
        .where(eq(litItems.public, true))
        .orderBy(desc(sql`coalesce(${litItems.publishedAt}, ${litItems.discoveredAt})`))
        .limit(200);

  const visibleRows = selectedStatus
    ? rows.filter((row) => (row.readStatus ?? "unread") === selectedStatus)
    : rows.filter((row) => !row.archived);
  const filteredRows = selectedType
    ? visibleRows.filter((row) => bucketForType(row.type) === selectedType)
    : visibleRows;
  const newRows = filteredRows.filter(isNewRow);
  const groupedRows = filteredRows.filter((row) => !isNewRow(row));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/lit" className="text-[12px] text-muted hover:text-fg">
              Literature review
            </Link>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Reading queue</h1>
          </div>
          {user && (
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              <Filter href="/lit/items" label="All" active={!selectedStatus} />
              {LIT_READ_STATUSES.map((status) => (
                <Filter
                  key={status}
                  href={`/lit/items?status=${status}`}
                  label={formatReadStatus(status)}
                  active={selectedStatus === status}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 text-[12px]">
            <Filter
              href={selectedStatus ? `/lit/items?status=${selectedStatus}` : "/lit/items"}
              label="All types"
              active={!selectedType}
            />
            {TYPE_FILTERS.map((filter) => (
              <Filter
                key={filter.value}
                href={`/lit/items?${new URLSearchParams({
                  ...(selectedStatus ? { status: selectedStatus } : {}),
                  type: filter.value,
                }).toString()}`}
                label={filter.label}
                active={selectedType === filter.value}
              />
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-6">
          {newRows.length > 0 && (
            <section>
              <header className="mb-2 flex items-center gap-2">
                <h2 className="text-[12px] font-semibold tracking-tight">New</h2>
                <span className="font-mono text-[11px] text-muted">{newRows.length}</span>
              </header>
              <div className="flex flex-col gap-2">
                {newRows.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
          {(selectedType
            ? TYPE_FILTERS.filter((filter) => filter.value === selectedType)
            : TYPE_FILTERS
          ).map((filter) => {
            const sectionRows = groupedRows.filter((row) => bucketForType(row.type) === filter.value);
            if (sectionRows.length === 0) return null;
            return (
              <section key={filter.value}>
                <header className="mb-2 flex items-center gap-2">
                  <h2 className="text-[12px] font-semibold tracking-tight">{filter.label}</h2>
                  <span className="font-mono text-[11px] text-muted">{sectionRows.length}</span>
                </header>
                <div className="flex flex-col gap-2">
                  {sectionRows.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
          {filteredRows.length === 0 && (
            <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[13px] text-muted">
              No items in this view.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: ItemRow }) {
  const readStatus = item.readStatus ?? null;
  return (
    <Link
      href={`/lit/items/${item.id}`}
      className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/60"
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
        <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
          {formatLitType(item.type)}
        </span>
        {readStatus && (
          <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
            {formatReadStatus(readStatus)}
          </span>
        )}
        <span>{item.sourceDetail ?? item.source ?? "workflow"}</span>
        <span>{formatLitDate(item.publishedAt ?? item.discoveredAt)}</span>
      </div>
      <h2 className="text-[13px] font-medium leading-snug">{item.title}</h2>
      {item.authorsJson && item.authorsJson.length > 0 && (
        <p className="mt-1 line-clamp-1 text-[11px] text-muted">
          {item.authorsJson.slice(0, 8).join(", ")}
        </p>
      )}
      {item.summary && (
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {item.summary}
        </p>
      )}
    </Link>
  );
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md border border-border bg-fg px-2.5 py-1 font-medium text-canvas"
          : "rounded-md border border-border bg-panel px-2.5 py-1 font-medium text-fg hover:bg-subtle"
      }
    >
      {label}
    </Link>
  );
}
