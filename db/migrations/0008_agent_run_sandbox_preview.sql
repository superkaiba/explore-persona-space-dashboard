ALTER TABLE "agent_run" ADD COLUMN IF NOT EXISTS "sandbox_preview" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "agent_run" SET "sandbox_preview" = true, "mode" = 'direct_apply' WHERE "mode" = 'sandbox_preview';
