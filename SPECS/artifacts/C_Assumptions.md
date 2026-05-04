---
name: assumptions
description: Living register of all assumptions made during specification. Review and mark each as approved [X], rejected [-], deferred [>], or pending [ ].
license: Apache-2.0 (see LICENSE in project root)
---

# Assumptions

> An assumption left unreviewed is a hidden risk. This register must be reviewed before any dependent work begins.
>
> **Status codes:** `[ ]` Pending · `[X]` Approved · `[-]` Rejected · `[>]` Deferred

---

## Summary

| Total | Pending `[ ]` | Approved `[X]` | Rejected `[-]` | Deferred `[>]` |
| :---: | :-----------: | :------------: | :------------: | :------------: |
| 8 | 8 | 0 | 0 | 0 |

---

## Business & Product

| Status | ID | Assumption | Impact if Wrong | Owner | Notes |
| :----: | :- | :--------- | :-------------- | :---- | :---- |
| `[X]` | A-BP-BIWKLYCD | Newsletter is generated on a biweekly cadence with a manual trigger — no scheduled automation required at MVP | If automation is needed, a cron/scheduler layer must be added | DevAgent | Confirmed in A_Project.md §3.1 |
| `[X]` | A-BP-SINGUSER | 2–3 internal operators will use the tool; no multi-tenancy or per-user data isolation required | If the user base grows, RBAC and per-user audit trails would be needed | DevAgent | Accepted for MVP; revisit if team expands |

## Users & Behavior

| Status | ID | Assumption | Impact if Wrong | Owner | Notes |
| :----: | :- | :--------- | :-------------- | :---- | :---- |
| `[X]` | A-UB-DESKONLY | Operators use the tool exclusively on desktop browsers; no mobile UX optimization required | If mobile usage is needed, responsive design work required | DevAgent | Bootstrap grid provides baseline responsiveness |
| `[X]` | A-UB-PDFCONV | Admin will convert all non-PDF source documents (DOCX, PPTX, etc.) to PDF before uploading | If admin cannot convert, other format parsers must be added | DevAgent | Confirmed in A_Project.md §3.1 |

## Technical

| Status | ID | Assumption | Impact if Wrong | Owner | Notes |
| :----: | :- | :--------- | :-------------- | :---- | :---- |
| `[X]` | A-TC-SAPCOMDOM | SAP Community article pages remain JS-rendered and scrapable via Playwright; DOM structure is stable enough for text extraction | If SAP Community changes its DOM structure, the scraper must be updated | DevAgent | Playwright approach is resilient to minor DOM changes; major redesign would break scraping |
| `[X]` | A-TC-HNAVEC | HANA Cloud `prod-eu10` instance supports the REAL_VECTOR type and HNSW indexing required for vector similarity search | If HANA version does not support REAL_VECTOR, an alternative vector store must be introduced | DevAgent | Must verify HANA Cloud version at project start |
| `[X]` | A-TC-AICOREDEP | SAP AI Core deployments `deaf6d11f22b1764` (gpt-4o) and `df7d80b9631d2737` (text-embedding-ada-002) remain active and available throughout development and operation | If deployments are deactivated, new deployment IDs must be configured via env vars | DevAgent | Deployment IDs in Kyma ConfigMap — no code change required for rotation |

## External Dependencies & Integrations

| Status | ID | Assumption | Impact if Wrong | Owner | Notes |
| :----: | :- | :--------- | :-------------- | :---- | :---- |
| `[X]` | A-EX-KYMACNCT | The Kyma cluster (`api.c-5a930ed.kyma.ondemand.com`) can reach HANA Cloud (`prod-eu10`) and SAP AI Core (`eu-central-1`) over the network without additional VPN or peering configuration | If network policies block these connections, Kyma egress rules must be updated | DevAgent | Standard BTP service connectivity; assumed to be configured |

## Compliance & Security

*No compliance assumptions — no external regulations apply (see B_Architecture.md §12).*

---

## Rejected Assumptions Log

| ID | Assumption | Rejected by | Date | Resolution |
| :- | :--------- | :---------- | :--: | :--------- |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial assumptions log populated from Planning phase | 2026-05-03 | SpecGantry |
