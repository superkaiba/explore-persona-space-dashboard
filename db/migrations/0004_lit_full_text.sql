CREATE TABLE IF NOT EXISTS "lit_item_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" text NOT NULL,
  "item_id" uuid NOT NULL,
  "source_url" text,
  "content_type" text,
  "status" text DEFAULT 'fetched' NOT NULL,
  "text_md" text,
  "text_plain" text,
  "text_sha256" text,
  "error" text,
  "fetched_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_item_document_chunk" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "chunk_index" integer NOT NULL,
  "text" text NOT NULL,
  "metadata_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lit_item_question" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "question" text NOT NULL,
  "answer_md" text,
  "citations_json" jsonb,
  "user_id" uuid,
  "user_email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_item_document" ADD CONSTRAINT "lit_item_document_item_id_lit_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lit_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_item_document_chunk" ADD CONSTRAINT "lit_item_document_chunk_document_id_lit_item_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."lit_item_document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_item_document_chunk" ADD CONSTRAINT "lit_item_document_chunk_item_id_lit_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lit_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lit_item_question" ADD CONSTRAINT "lit_item_question_item_id_lit_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lit_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_item_document_external_id_unique" ON "lit_item_document" USING btree ("external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_document_item_idx" ON "lit_item_document" USING btree ("item_id","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lit_item_document_chunk_unique" ON "lit_item_document_chunk" USING btree ("document_id","chunk_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_document_chunk_item_idx" ON "lit_item_document_chunk" USING btree ("item_id","chunk_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_document_chunk_search_idx" ON "lit_item_document_chunk" USING gin (to_tsvector('english', "text"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_question_item_idx" ON "lit_item_question" USING btree ("item_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lit_item_question_user_idx" ON "lit_item_question" USING btree ("user_id","created_at");
