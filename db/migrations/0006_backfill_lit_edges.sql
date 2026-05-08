INSERT INTO "edge" ("from_kind", "from_id", "to_kind", "to_id", "type", "created_at")
SELECT
  'research_idea'::"entity_kind",
  "idea_id",
  'lit_item'::"entity_kind",
  "item_id",
  "relation_type"::text::"edge_type",
  "created_at"
FROM "lit_idea_link"
WHERE "status" = 'accepted'
ON CONFLICT DO NOTHING;
