CREATE TYPE "public"."agent_run_mode" AS ENUM('clarify', 'direct_apply', 'sandbox_preview');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'running', 'awaiting_approval', 'approved', 'rejected', 'deploying', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "agent_run_mode" NOT NULL,
	"status" "agent_run_status" DEFAULT 'queued' NOT NULL,
	"request" text NOT NULL,
	"summary" text,
	"chat_session_id" uuid,
	"scope_entity_kind" "entity_kind",
	"scope_entity_id" uuid,
	"branch_name" text,
	"worktree_path" text,
	"base_sha" text,
	"head_sha" text,
	"preview_url" text,
	"production_url" text,
	"vercel_deployment_url" text,
	"changed_files_json" jsonb,
	"checks_json" jsonb,
	"last_error" text,
	"created_by_user_id" uuid,
	"created_by_user_email" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_run_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"body" text,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_chat_session_id_chat_session_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_session"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_run_event" ADD CONSTRAINT "agent_run_event_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_status_idx" ON "agent_run" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_chat_session_idx" ON "agent_run" USING btree ("chat_session_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_event_run_idx" ON "agent_run_event" USING btree ("run_id","created_at");
