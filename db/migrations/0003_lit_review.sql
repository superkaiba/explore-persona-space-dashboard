DO $$ BEGIN
 CREATE TYPE "public"."lit_item_type" AS ENUM('paper', 'blog_post', 'forum_post', 'newsletter', 'report', 'repo', 'video', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lit_read_status" AS ENUM('unread', 'skimmed', 'read');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lit_relation_type" AS ENUM('supports', 'contradicts', 'method', 'baseline', 'background', 'threat', 'inspiration');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lit_link_status" AS ENUM('proposed', 'accepted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lit_link_source" AS ENUM('auto', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."research_idea_status" AS ENUM('seed', 'active', 'paused', 'developed', 'abandoned');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text NOT NULL,
  "type" "lit_item_type" DEFAULT 'paper' NOT NULL,
  "title" text NOT NULL,
  "authors_json" jsonb,
  "abstract" text,
  "summary" text,
  "url" text,
  "pdf_url" text,
  "arxiv_id" text,
  "doi" text,
  "source" text,
  "source_detail" text,
  "tags_json" jsonb,
  "metadata_json" jsonb,
  "published_at" timestamp with time zone,
  "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "workflow_updated_at" timestamp with time zone,
  "public" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_item_analysis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text NOT NULL,
  "item_id" uuid NOT NULL,
  "analysis_md" text,
  "tldr" text,
  "threat_level" text,
  "read_signal" text,
  "section" text,
  "aim_tag" text,
  "source_path" text,
  "generated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_idea" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "status" "research_idea_status" DEFAULT 'seed' NOT NULL,
  "short_summary" text,
  "expanded_summary" text,
  "hypothesis" text,
  "motivation" text,
  "next_experiments" text,
  "source_path" text,
  "public" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_idea_clarification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_id" uuid NOT NULL,
  "body" text NOT NULL,
  "public" boolean DEFAULT false NOT NULL,
  "user_id" uuid,
  "user_email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_idea_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "relation_type" "lit_relation_type" DEFAULT 'background' NOT NULL,
  "confidence" real,
  "rationale" text,
  "status" "lit_link_status" DEFAULT 'proposed' NOT NULL,
  "source" "lit_link_source" DEFAULT 'auto' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_idea_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text,
  "idea_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "body" text NOT NULL,
  "public" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_idea_event" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_digest_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_date" text NOT NULL,
  "status" text DEFAULT 'imported' NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "candidate_count" integer,
  "selected_count" integer,
  "log_path" text,
  "summary_md" text,
  "notification_status" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_item_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "user_email" text,
  "read_status" "lit_read_status" DEFAULT 'unread' NOT NULL,
  "notes" text,
  "archived" boolean DEFAULT false NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_item_analysis" ADD CONSTRAINT "lit_item_analysis_item_id_lit_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lit_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_idea_clarification" ADD CONSTRAINT "research_idea_clarification_idea_id_research_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."research_idea"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_idea_link" ADD CONSTRAINT "lit_idea_link_idea_id_research_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."research_idea"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_idea_link" ADD CONSTRAINT "lit_idea_link_item_id_lit_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lit_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_idea_event" ADD CONSTRAINT "research_idea_event_idea_id_research_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."research_idea"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_item_state" ADD CONSTRAINT "lit_item_state_item_id_lit_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lit_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_item_external_id_unique" ON "lit_item" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_recent_idx" ON "lit_item" USING btree ("published_at","discovered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_type_idx" ON "lit_item" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_item_analysis_external_id_unique" ON "lit_item_analysis" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_analysis_item_idx" ON "lit_item_analysis" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_idea_external_id_unique" ON "research_idea" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_idea_slug_unique" ON "research_idea" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_idea_status_idx" ON "research_idea" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_idea_clarification_idea_idx" ON "research_idea_clarification" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_idea_link_unique" ON "lit_idea_link" USING btree ("idea_id","item_id","relation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_idea_link_idea_idx" ON "lit_idea_link" USING btree ("idea_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_idea_link_item_idx" ON "lit_idea_link" USING btree ("item_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_idea_event_external_id_unique" ON "research_idea_event" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_idea_event_idea_idx" ON "research_idea_event" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_digest_run_date_unique" ON "lit_digest_run" USING btree ("run_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_digest_run_recent_idx" ON "lit_digest_run" USING btree ("run_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_item_state_item_user_unique" ON "lit_item_state" USING btree ("item_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_state_user_idx" ON "lit_item_state" USING btree ("user_id","read_status","updated_at");
