ALTER TABLE "agent_run" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'claude_code' NOT NULL;
