---
name: risks
description: Living register of all risks identified during specification. Review and mark each as accepted [X], mitigated [M], rejected [-], deferred [>], or pending [ ].
license: Apache-2.0 (see LICENSE in project root)
---

# Risks

> An unreviewed risk is an unmanaged risk. This register must be reviewed before dependent work begins.
> High-severity risks with no mitigation or owner must be escalated before implementation proceeds.
>
> **Status codes:** `[ ]` Pending · `[X]` Accepted · `[M]` Mitigated · `[-]` Dismissed · `[>]` Deferred
>
> **Likelihood:** `H` High · `M` Medium · `L` Low
>
> **Severity:** `H` High · `M` Medium · `L` Low
>
> **Risk score** = Likelihood × Severity → `HH` = critical · `HM` / `MH` = significant · `MM` = moderate · anything with `L` = low

---

## Summary

| Total | Pending `[ ]` | Accepted `[X]` | Mitigated `[M]` | Dismissed `[-]` | Deferred `[>]` | Critical `HH` |
| :---: | :-----------: | :------------: | :-------------: | :-------------: | :------------: | :-----------: |
| 7 | 0 | 5 | 0 | 1 | 0 | 0 |

---

## Critical & High Priority

> Risks scored `HH`, `HM`, or `MH`. Must be resolved or have an active mitigation plan before work begins.

*None — no critical or high-priority risks identified.*

---

## Technical

| Status | ID | Risk | Likelihood | Severity | Score | Mitigation | Contingency | Owner | Review by |
| :----: | :- | :--- | :--------: | :------: | :---: | :--------- | :---------- | :---- | :-------: |
| `[X]` | R-TC-DOMBREAK | SAP Community DOM structure changes, breaking Playwright scraper | M | M | MM | Playwright selects by semantic text content where possible; scraper isolated in C01 for easy update | Admin falls back to ad-hoc URL ingestion; scraper updated in next release | DevAgent | 2026-08-03 |
| `[-]` | R-TC-VECTYPE | HANA Cloud instance does not support REAL_VECTOR type or HNSW indexing | L | H | LH | Verify HANA version before development begins (see A-TC-HNAVEC) | Use pgvector on a separate PostgreSQL instance as fallback vector store | DevAgent | 2026-05-10 |
| `[X]` | R-TC-CONTSIZE | Docker image size exceeds Kyma resource limits due to Playwright + Chromium (~300MB) | M | M | MM | Multi-stage Dockerfile keeps final image lean; Playwright uses `chromium` channel only | Investigate Playwright remote browser service or switch to Puppeteer-core with external Chromium | DevAgent | 2026-05-03 |
| `[X]` | R-TC-LLMTONE | LLM generates content that violates educational tone guardrail (guidance/recommendation language) | M | M | MM | Dedicated guardrail prompt in `./src/ai/prompts/guardrail-check.md`; flagged sections highlighted in UI for author review | Author manually edits flagged sections before publishing | DevAgent | 2026-08-03 |

## Business & Product

| Status | ID | Risk | Likelihood | Severity | Score | Mitigation | Contingency | Owner | Review by |
| :----: | :- | :--- | :--------: | :------: | :---: | :--------- | :---------- | :---- | :-------: |
| `[X]` | R-BP-MANUAL30 | Newsletter generation takes > 30 minutes of active effort, missing the north-star metric | L | M | LM | Streaming UI, pre-suggested topic list, and single-click generation minimise active effort | Identify bottleneck (LLM latency vs. UX friction) and address post-MVP | DevAgent | 2026-08-03 |

## External Dependencies & Integrations

| Status | ID | Risk | Likelihood | Severity | Score | Mitigation | Contingency | Owner | Review by |
| :----: | :- | :--- | :--------: | :------: | :---: | :--------- | :---------- | :---- | :-------: |
| `[X]` | R-EX-AICOREDN | SAP AI Core deployment IDs change or deployments are deactivated | L | H | LH | Deployment IDs stored in Kyma ConfigMap env vars — no code change needed for rotation | Update ConfigMap and redeploy; generation blocked until updated | DevAgent | 2026-08-03 |
| `[X]` | R-EX-APIKEY | Shared API key is compromised — no per-user attribution to identify source | L | M | LM | Key stored in Kyma Secret; TLS in transit; limited operator access | Rotate key immediately (update Kyma Secret + redeploy) | DevAgent | 2026-08-03 |

## People & Process

*No people/process risks identified at this stage.*

## Security & Compliance

*No additional security/compliance risks beyond those captured above.*

---

## Dismissed Risks Log

| ID | Risk | Dismissed by | Date | Rationale |
| :- | :--- | :----------- | :--: | :-------- |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial risks log populated from Planning phase | 2026-05-03 | SpecGantry |
