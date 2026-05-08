ALTER TYPE "public"."entity_kind" ADD VALUE IF NOT EXISTS 'project';
--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE IF NOT EXISTS 'research_idea';
--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE IF NOT EXISTS 'lit_item';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'cites';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'inspired_by';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'tests';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'produces_evidence_for';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'blocks';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'answers';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'duplicates';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'method';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'baseline';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'background';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'threat';
--> statement-breakpoint
ALTER TYPE "public"."edge_type" ADD VALUE IF NOT EXISTS 'inspiration';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "summary" text,
  "public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_slug_unique" ON "project" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_status_idx" ON "project" USING btree ("status","updated_at");
--> statement-breakpoint
ALTER TABLE "lit_item" ALTER COLUMN "public" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "research_idea" ALTER COLUMN "public" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "research_idea_event" ALTER COLUMN "public" SET DEFAULT false;
