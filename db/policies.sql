-- Row-level security policies.
--
-- Public dashboard: anyone (anon role) can SELECT entity rows.
-- Only authenticated users (you, signed in via GitHub OAuth) can INSERT/UPDATE/DELETE.
-- Chat sessions and chat messages are auth-only (read AND write) since chat is private.
--
-- Apply once after `pnpm db:push` via `pnpm db:init-rls`.
-- Idempotent: safe to re-run (DROP IF EXISTS, then CREATE).

-- ── enable RLS on every table ─────────────────────────────────────────────
ALTER TABLE claim          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project        ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment     ENABLE ROW LEVEL SECURITY;
ALTER TABLE run            ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo           ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge           ENABLE ROW LEVEL SECURITY;
ALTER TABLE figure         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_session   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_item       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_item_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_idea  ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_idea_clarification ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_idea_link  ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_idea_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_digest_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_item_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_item_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_item_document_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE lit_item_question ENABLE ROW LEVEL SECURITY;

-- ── public-readable entity tables ─────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'claim', 'experiment', 'run', 'todo',
    'figure', 'agent_task'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_read ON %I', t);
    EXECUTE format(
      'CREATE POLICY public_read ON %I FOR SELECT TO anon, authenticated USING (true)', t
    );
    EXECUTE format('DROP POLICY IF EXISTS auth_write_insert ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_write_insert ON %I FOR INSERT TO authenticated WITH CHECK (true)', t
    );
    EXECUTE format('DROP POLICY IF EXISTS auth_write_update ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_write_update ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t
    );
    EXECUTE format('DROP POLICY IF EXISTS auth_write_delete ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_write_delete ON %I FOR DELETE TO authenticated USING (true)', t
    );
  END LOOP;
END $$;

-- Edges can now point at private ideas/literature, so anon reads must only
-- expose relationships whose endpoints are public-readable.
DROP POLICY IF EXISTS public_read ON edge;
DROP POLICY IF EXISTS anon_read_public_edge ON edge;
CREATE POLICY anon_read_public_edge ON edge
  FOR SELECT TO anon USING (
    (
      from_kind::text IN ('claim', 'experiment', 'run', 'todo')
      OR (
        from_kind::text = 'project'
        AND EXISTS (
          SELECT 1 FROM project
          WHERE project.id = edge.from_id
            AND project."public" = true
        )
      )
      OR (
        from_kind::text = 'research_idea'
        AND EXISTS (
          SELECT 1 FROM research_idea
          WHERE research_idea.id = edge.from_id
            AND research_idea."public" = true
        )
      )
      OR (
        from_kind::text = 'lit_item'
        AND EXISTS (
          SELECT 1 FROM lit_item
          WHERE lit_item.id = edge.from_id
            AND lit_item."public" = true
        )
      )
    )
    AND
    (
      to_kind::text IN ('claim', 'experiment', 'run', 'todo')
      OR (
        to_kind::text = 'project'
        AND EXISTS (
          SELECT 1 FROM project
          WHERE project.id = edge.to_id
            AND project."public" = true
        )
      )
      OR (
        to_kind::text = 'research_idea'
        AND EXISTS (
          SELECT 1 FROM research_idea
          WHERE research_idea.id = edge.to_id
            AND research_idea."public" = true
        )
      )
      OR (
        to_kind::text = 'lit_item'
        AND EXISTS (
          SELECT 1 FROM lit_item
          WHERE lit_item.id = edge.to_id
            AND lit_item."public" = true
        )
      )
    )
  );

DROP POLICY IF EXISTS auth_read_edge ON edge;
CREATE POLICY auth_read_edge ON edge
  FOR SELECT TO authenticated USING (true);

DO $$
DECLARE
  t text := 'edge';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS auth_write_insert ON %I', t);
  EXECUTE format(
    'CREATE POLICY auth_write_insert ON %I FOR INSERT TO authenticated WITH CHECK (true)', t
  );
  EXECUTE format('DROP POLICY IF EXISTS auth_write_update ON %I', t);
  EXECUTE format(
    'CREATE POLICY auth_write_update ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t
  );
  EXECUTE format('DROP POLICY IF EXISTS auth_write_delete ON %I', t);
  EXECUTE format(
    'CREATE POLICY auth_write_delete ON %I FOR DELETE TO authenticated USING (true)', t
  );
END $$;

-- Comments are private workspace notes by default.
DROP POLICY IF EXISTS public_read ON comment;
DROP POLICY IF EXISTS auth_only_comment ON comment;
CREATE POLICY auth_only_comment ON comment
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── chat tables: authenticated-only (read AND write) ──────────────────────
DROP POLICY IF EXISTS auth_only_agent_run ON agent_run;
CREATE POLICY auth_only_agent_run ON agent_run
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_agent_run_event ON agent_run_event;
CREATE POLICY auth_only_agent_run_event ON agent_run_event
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_chat_session ON chat_session;
CREATE POLICY auth_only_chat_session ON chat_session
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_chat_message ON chat_message;
CREATE POLICY auth_only_chat_message ON chat_message
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── literature review: public reader, authenticated curation ─────────────
DROP POLICY IF EXISTS public_read_project ON project;
CREATE POLICY public_read_project ON project
  FOR SELECT TO anon, authenticated USING ("public" = true);

DROP POLICY IF EXISTS public_read_lit_item ON lit_item;
CREATE POLICY public_read_lit_item ON lit_item
  FOR SELECT TO anon, authenticated USING ("public" = true);

DROP POLICY IF EXISTS public_read_lit_item_analysis ON lit_item_analysis;
CREATE POLICY public_read_lit_item_analysis ON lit_item_analysis
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM lit_item
      WHERE lit_item.id = lit_item_analysis.item_id
        AND lit_item."public" = true
    )
  );

DROP POLICY IF EXISTS public_read_research_idea ON research_idea;
CREATE POLICY public_read_research_idea ON research_idea
  FOR SELECT TO anon, authenticated USING ("public" = true);

DROP POLICY IF EXISTS public_read_lit_idea_link ON lit_idea_link;
CREATE POLICY public_read_lit_idea_link ON lit_idea_link
  FOR SELECT TO anon, authenticated USING (
    status = 'accepted'
    AND EXISTS (
      SELECT 1 FROM research_idea
      WHERE research_idea.id = lit_idea_link.idea_id
        AND research_idea."public" = true
    )
    AND EXISTS (
      SELECT 1 FROM lit_item
      WHERE lit_item.id = lit_idea_link.item_id
        AND lit_item."public" = true
    )
  );

DROP POLICY IF EXISTS public_read_research_idea_event ON research_idea_event;
CREATE POLICY public_read_research_idea_event ON research_idea_event
  FOR SELECT TO anon, authenticated USING (
    "public" = true
    AND EXISTS (
      SELECT 1 FROM research_idea
      WHERE research_idea.id = research_idea_event.idea_id
        AND research_idea."public" = true
    )
  );

DROP POLICY IF EXISTS public_read_lit_digest_run ON lit_digest_run;
CREATE POLICY public_read_lit_digest_run ON lit_digest_run
  FOR SELECT TO anon, authenticated USING (true);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lit_item', 'lit_item_analysis', 'research_idea',
    'lit_idea_link', 'research_idea_event', 'lit_digest_run', 'project'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_read_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_read_all ON %I FOR SELECT TO authenticated USING (true)', t
    );
    EXECUTE format('DROP POLICY IF EXISTS auth_write_insert ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_write_insert ON %I FOR INSERT TO authenticated WITH CHECK (true)', t
    );
    EXECUTE format('DROP POLICY IF EXISTS auth_write_update ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_write_update ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t
    );
    EXECUTE format('DROP POLICY IF EXISTS auth_write_delete ON %I', t);
    EXECUTE format(
      'CREATE POLICY auth_write_delete ON %I FOR DELETE TO authenticated USING (true)', t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS auth_only_research_idea_clarification ON research_idea_clarification;
CREATE POLICY auth_only_research_idea_clarification ON research_idea_clarification
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_lit_item_state ON lit_item_state;
CREATE POLICY auth_only_lit_item_state ON lit_item_state
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_lit_item_document ON lit_item_document;
CREATE POLICY auth_only_lit_item_document ON lit_item_document
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_lit_item_document_chunk ON lit_item_document_chunk;
CREATE POLICY auth_only_lit_item_document_chunk ON lit_item_document_chunk
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_lit_item_question ON lit_item_question;
CREATE POLICY auth_only_lit_item_question ON lit_item_question
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
