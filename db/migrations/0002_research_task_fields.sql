ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'inbox';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'scoped';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'planning';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'running';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'interpreting';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'awaiting_promotion';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'blocked';--> statement-breakpoint
ALTER TYPE "public"."todo_status" ADD VALUE IF NOT EXISTS 'archived';--> statement-breakpoint
ALTER TABLE "todo" ALTER COLUMN "status" SET DEFAULT 'inbox';--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN IF NOT EXISTS "intent_mode" text DEFAULT 'exploratory' NOT NULL;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN IF NOT EXISTS "intent_summary" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN IF NOT EXISTS "useful_if" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN IF NOT EXISTS "owner_note" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
