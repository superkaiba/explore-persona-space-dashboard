import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { displayEdgeType, ENTITY_KIND_LABEL } from "@/lib/entities";
import type { RelatedEntity } from "@/lib/related-entities";

export function RelatedEntitiesList({ items }: { items: RelatedEntity[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-subtle/40 p-3 text-center text-[12px] text-muted">
        No cross-links yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const content = (
          <>
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                {ENTITY_KIND_LABEL[item.kind]}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-canvas px-1.5 py-0.5 font-medium text-muted">
                {item.direction === "outgoing" ? (
                  <ArrowUpRight className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDownLeft className="h-2.5 w-2.5" />
                )}
                {displayEdgeType(item.edgeType)}
              </span>
              {item.detail && <span>{item.detail}</span>}
            </div>
            <div className="line-clamp-2 text-[12.5px] font-medium leading-snug">
              {item.title}
            </div>
          </>
        );

        return item.href ? (
          <Link
            key={`${item.direction}:${item.kind}:${item.id}:${item.edgeType}`}
            href={item.href}
            className="rounded-md border border-border bg-panel p-2.5 shadow-card hover:bg-subtle/70"
          >
            {content}
          </Link>
        ) : (
          <div
            key={`${item.direction}:${item.kind}:${item.id}:${item.edgeType}`}
            className="rounded-md border border-border bg-panel p-2.5 shadow-card"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
