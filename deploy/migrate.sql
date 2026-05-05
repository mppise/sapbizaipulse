-- SAP BizAI Pulse — HANA Cloud schema migration
-- Run once on a fresh schema. Re-running will fail if tables already exist.
-- [F-C05-SCHEMA]

CREATE TABLE content_entries (
  id             NVARCHAR(36)    NOT NULL DEFAULT SYSUUID,
  title          NVARCHAR(512)   NOT NULL,
  body_text      NCLOB           NOT NULL,
  source_type    NVARCHAR(16)    NOT NULL,
  source_ref     NVARCHAR(2048)  NOT NULL,
  ingestion_date TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_date TIMESTAMP,
  approved_at    TIMESTAMP,
  sensitivity    NVARCHAR(32)    NOT NULL DEFAULT 'Internal',
  embedding      REAL_VECTOR(1536),
  PRIMARY KEY (id)
);

-- For existing deployments: add columns if the table already exists.
-- ALTER TABLE content_entries ADD (approved_at TIMESTAMP);
-- ALTER TABLE content_entries ADD (published_date TIMESTAMP);

-- Vector index: run manually once content_entries has embedding data.
DROP INDEX content_entries_embedding_idx;
CREATE VECTOR INDEX content_entries_embedding_idx
  ON content_entries (embedding)
  USING HNSW
  WITH (M = 16, EF_CONSTRUCTION = 100);

CREATE TABLE newsletters (
  id               NVARCHAR(36)    NOT NULL DEFAULT SYSUUID,
  filename         NVARCHAR(512)   NOT NULL,
  status           NVARCHAR(16)    NOT NULL DEFAULT 'draft',
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at     TIMESTAMP,
  topic_list       NCLOB,
  object_store_key NVARCHAR(2048),
  PRIMARY KEY (id)
);
