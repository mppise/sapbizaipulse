---
name: c05-data-store-core-spec
description: Core specification for C05 Data Store — HANA Cloud data access layer for SAP BizAI Pulse.
license: Apache-2.0 (see LICENSE in project root)
---

# C05 Data Store — Core Specification

> Pure data access layer. Owns the HANA Cloud schema, provides typed query functions for content entries, newsletter metadata, and vector similarity search. No business logic lives here.

---

## 1. Purpose

C05 is the sole interface between the application and HANA Cloud. It:

- Owns the `content_entries` and `newsletters` table definitions and migration scripts.
- Provides typed, parameterised query functions consumed in-process by C01, C02, and C03.
- Manages the HANA Cloud connection pool lifecycle.
- Enforces that no raw SQL is written outside this component.

---

## 2. Features

| Status | ID | Description | Priority | Doc Level |
| :----: | :- | :---------- | :------: | :-------: |
| `Complete` | F-C05-CONNPOOL | Initialise and manage a HANA Cloud connection pool on application startup; expose a `getConnection()` helper used by all query functions | P0 | - |
| `Complete` | F-C05-SCHEMA | Provide a schema migration script (`./deploy/migrate.sql`) that creates `content_entries` and `newsletters` tables and the HNSW vector index if they do not exist | P0 | - |
| `Complete` | F-C05-CE-INSERT | Insert a new content entry (all fields except embedding; embedding updated separately) | P0 | - |
| `Complete` | F-C05-CE-UPSERT-VEC | Update the `embedding` column for a given content entry by ID | P0 | - |
| `Complete` | F-C05-CE-READ | Retrieve a single content entry by ID | P0 | - |
| `Complete` | F-C05-CE-LIST | List all content entries with optional filter by `sensitivity` tag; returns metadata fields only (no embedding vector in list response) | P0 | - |
| `Complete` | F-C05-CE-UPDATE | Update mutable fields of a content entry (`title`, `sensitivity`) | P0 | - |
| `Complete` | F-C05-CE-DELETE | Delete a content entry by ID | P0 | - |
| `Complete` | F-C05-CE-DUPCHECK | Check whether a content entry with the same `source_ref` already exists (duplicate URL/filename detection) | P0 | - |
| `Complete` | F-C05-VEC-SEARCH | Perform a HANA Cloud REAL_VECTOR cosine-similarity search against `content_entries` where `sensitivity = 'Newsletter-ready'`; return top-K results with score | P0 | - |
| `Complete` | F-C05-NL-INSERT | Insert a new newsletter record | P0 | - |
| `Complete` | F-C05-NL-READ | Retrieve a single newsletter record by ID | P0 | - |
| `Complete` | F-C05-NL-LIST | List all newsletter records ordered by `created_at` descending | P0 | - |
| `Complete` | F-C05-NL-UPDATE | Update newsletter record fields (`status`, `published_at`, `object_store_key`) | P0 | - |
| `Complete` | F-C05-NL-DELETE | Delete a newsletter record by ID | P0 | - |
| `Complete` | F-C05-HEALTH | Expose a `ping()` function that executes `SELECT 1 FROM DUMMY` to verify HANA connectivity; used by the `/health` endpoint | P0 | - |

---

## 3. Dependencies

| Dependency | Type | Direction | Notes |
| :--------- | :--- | :-------- | :---- |
| HANA Cloud (`prod-eu10`) | External managed service | Outbound | TCP via `@sap/hana-client`; credentials from env vars |
| `@sap/hana-client` | Library | Consumed | Connection pool and SQL execution |

C05 has **no dependencies on other application components** (C01–C04). It is a leaf node in the dependency graph.

---

## 4. Data Flows

### 4.1 Inbound (callers writing to C05)

| Caller | Operation | C05 function |
| :----- | :-------- | :----------- |
| C01 Content Curator | Insert new content entry | `insertContentEntry()` |
| C01 Content Curator | Attach embedding to entry | `updateContentEntryEmbedding()` |
| C01 Content Curator | Update entry metadata | `updateContentEntry()` |
| C01 Content Curator | Delete entry | `deleteContentEntry()` |
| C01 Content Curator | Duplicate check before insert | `contentEntryExistsBySourceRef()` |
| C02 Newsletter Generator | Vector similarity search | `vectorSearch()` |
| C02 Newsletter Generator | List Newsletter-ready entries | `listContentEntries({ sensitivity: 'Newsletter-ready' })` |
| C03 Newsletter Lifecycle | Insert newsletter record | `insertNewsletter()` |
| C03 Newsletter Lifecycle | Update newsletter status/key | `updateNewsletter()` |
| C03 Newsletter Lifecycle | Delete newsletter | `deleteNewsletter()` |
| C03 Newsletter Lifecycle | Read/list newsletters | `getNewsletter()` / `listNewsletters()` |

### 4.2 Outbound (C05 calling external systems)

| Target | Protocol | Purpose |
| :----- | :------- | :------ |
| HANA Cloud | TCP (`@sap/hana-client`) | All SQL read/write/vector operations |

---

## 5. Execution Mode

- **Synchronous** in-process function calls only. No background workers, queues, or event emitters.
- Connection pool is initialised once at application startup (`initPool()`) and shared across all callers.
- All functions are `async` and return typed results or throw a structured `DataStoreError`.

---

## 6. Schema

### 6.1 `content_entries`

```sql
CREATE TABLE content_entries (
  id             NVARCHAR(36)    NOT NULL DEFAULT SYSUUID,
  title          NVARCHAR(512)   NOT NULL,
  body_text      NCLOB           NOT NULL,
  source_type    NVARCHAR(16)    NOT NULL,  -- 'auto-fetch' | 'pdf' | 'url'
  source_ref     NVARCHAR(2048)  NOT NULL,  -- URL or filename
  ingestion_date TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sensitivity    NVARCHAR(32)    NOT NULL DEFAULT 'Internal',  -- 'Internal' | 'Newsletter-ready'
  embedding      REAL_VECTOR(1536),
  PRIMARY KEY (id)
);

CREATE VECTOR INDEX content_entries_embedding_idx
  ON content_entries (embedding)
  USING HNSW
  WITH (M = 16, EF_CONSTRUCTION = 100);
```

### 6.2 `newsletters`

```sql
CREATE TABLE newsletters (
  id               NVARCHAR(36)    NOT NULL DEFAULT SYSUUID,
  filename         NVARCHAR(512)   NOT NULL,
  status           NVARCHAR(16)    NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at     TIMESTAMP,
  topic_list       NCLOB,           -- JSON array of topic title strings
  object_store_key NVARCHAR(2048),  -- SAP Object Store key for the .md/.html file
  PRIMARY KEY (id)
);
```

> `object_store_key` stores the SAP Object Store key for the associated `.md` (draft) or `.html` (published) file. This field is nullable; it is set when C03 writes the file to Object Store and updated to the `.html` key on publish. See D-DATA-FILESYS.

---

## 7. Error Handling

All public functions wrap HANA errors in a `DataStoreError` with:

| Field | Type | Description |
| :---- | :--- | :---------- |
| `code` | `string` | Stable error code (e.g. `DS_CONN_FAILED`, `DS_QUERY_FAILED`, `DS_NOT_FOUND`) |
| `message` | `string` | Human-readable description |
| `cause` | `Error \| undefined` | Original HANA client error |

Callers (C01, C02, C03) are responsible for mapping `DataStoreError` to API-layer error responses.

---

## 8. Configuration

All connection parameters are read from environment variables at pool initialisation time. No defaults are provided for credential values — startup fails fast if any are missing.

| Env var | Purpose |
| :------ | :------ |
| `HANA_HOST` | HANA Cloud hostname |
| `HANA_PORT` | HANA Cloud port (typically 443) |
| `HANA_USER` | HANA Cloud user |
| `HANA_PASSWORD` | HANA Cloud password |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
