---
name: brainstorm
argument-hint: issue_for_brainstorming
description: Facilitates a structured multi-perspective analysis when there is no clear approach or when trade-offs are significant — produces a decision-ready Proposal for DevLead's explicit approval.
user-invocable: false
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Brainstorm

> Stepping back from the work to play every side of this debate — my job is to make the trade-offs visible so you can make a clear, informed engineering choice.

## Issue

{{ issue_for_brainstorming }}

## Before Starting

If the issue statement is unclear or lacks sufficient context to argue meaningfully, ask DevLead **one clarifying question** before beginning the debate. Do not proceed with a vague issue — the quality of the verdict depends on the clarity of the problem.

## Format

This session follows the Lincoln-Douglas debate structure. I independently play three roles:

| Role | Responsibility |
|---|---|
| **AFF (Affirmative)** | Argues the strongest case *for* the proposed approach — benefits, advantages, strengths. |
| **NEG (Negative)** | Argues the strongest case *against* — drawbacks, risks, limitations. |
| **Judge** | Evaluates both sides impartially. Does **not** pick a winner — presents viable paths with a trade-off analysis so DevLead makes the final call. |

## Debate Stages

Keep each stage proportionate to the complexity of the issue — 2 to 4 key arguments per stage is the target. Depth over breadth; avoid exhaustive lists.

| Stage | Speaker |
|---|---|
| 1AC — Affirmative Constructive | AFF presents the case for the approach |
| CX — Cross Examination | NEG questions AFF to expose logical gaps |
| 1NC/1NR — Negative Constructive | NEG presents the case against |
| CX — Cross Examination | AFF questions NEG |
| 1AR — First Affirmative Rebuttal | AFF addresses NEG's case and defends their own |
| NR/2NR — Negative Rebuttal | NEG summarizes and responds to 1AR |
| 2AR — Second Affirmative Rebuttal | AFF closes — no new arguments allowed |

## Judge's Verdict

After the debate, the Judge produces a **Proposal for Review** containing:

- **Options**: At least two viable paths (e.g., "Conservative" vs. "Optimized").
- **Trade-off Matrix**: Comparison across Risk, Velocity, Maintainability, and Performance.
- **Justification**: A "Why" for each option — the logic behind the trade-offs, not just a ranking.

The Judge's role is to force an active engineering choice. DevLead must **explicitly approve** one option before it is implemented or recorded in any project artifact. SpecGantry does not decide unilaterally.

## Output

The Proposal for Review is presented inline — no project files are created or modified by this skill.
