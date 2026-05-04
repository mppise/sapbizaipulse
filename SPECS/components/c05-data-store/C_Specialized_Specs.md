---
name: c05-data-store-specialized-specs
description: NFR thresholds and connection pool behaviour for C05 Data Store.
license: Apache-2.0 (see LICENSE in project root)
---

# C05 Data Store — Specialized Specifications

> No AI integration. Covers NFRs and retry behaviour.

---

## 1. Non-Functional Requirements

| ID | Requirement | Threshold | Measurement | Priority |
| :- | :---------- | :-------- | :---------- | :------: |
| NFR-C05-VSPERF | Vector search (`vectorSearch()`) must return top-K results | < 3s at projected data volume (≤ 5,000 entries) | Measured from function call entry to result return | P0 |
| NFR-C05-POOL | Connection pool must satisfy concurrent requests from C01, C02, C03 without deadlock | max 10 connections; acquire timeout 5s | Load test with 3 concurrent callers | P1 |
| NFR-C05-STARTUP | Pool initialisation must complete | < 5s on application startup | Measured from `initPool()` call to resolution | P1 |
| NFR-C05-RETRY | Transient HANA query failures retried automatically | Max 3 attempts; exponential backoff starting 500ms ± 100ms jitter | Error logs show retry attempts | P0 |
| NFR-C05-PARAMQ | All SQL must use parameterised queries | 100% — no string concatenation in any SQL statement | Code review / audit | P0 |

---

## 2. Retry Behaviour

Applies to all query functions in `contentEntries.ts`, `newsletters.ts`, `vectorSearch.ts`, and `health.ts`.

| Attempt | Delay before retry |
| :------ | :----------------- |
| 1 (initial) | — |
| 2 | 500ms ± 100ms jitter |
| 3 | 1000ms ± 100ms jitter |
| 4 (final fail) | Throw `DataStoreError (DS_QUERY_FAILED)` |

**Retry-eligible errors:** HANA client connection errors, timeout errors, transient `SQLERROR` with codes indicating temporary unavailability.

**Non-retryable errors:** `DS_NOT_FOUND`, `DS_DUPLICATE`, constraint violations — throw immediately without retry.

---

## 3. Vector Index Configuration

The HNSW index parameters balance recall quality against index build time at MVP scale:

| Parameter | Value | Rationale |
| :-------- | :---- | :-------- |
| `M` | 16 | Controls graph connectivity; 16 is the standard default for balanced recall/speed |
| `EF_CONSTRUCTION` | 100 | Higher = better recall during index build; 100 is adequate for ≤ 5,000 entries |

These values are set once at schema creation in `migrate.sql`. Tuning is deferred to post-MVP if retrieval quality issues emerge.

---

## 4. Migration Script Contract

`./deploy/migrate.sql` must be **idempotent** — safe to run on first deploy and on re-deploy without data loss:

```sql
-- Use CREATE TABLE IF NOT EXISTS for both tables.
-- Use CREATE VECTOR INDEX ... IF NOT EXISTS for the HNSW index.
-- No DROP statements in the migration script.
```

The migration script is run manually by the operator before first use (see `B_Architecture.md §16.6`).

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
