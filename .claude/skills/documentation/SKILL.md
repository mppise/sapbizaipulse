---
name: documentation
argument-hint: key_feature
description: Generates user documentation for a given feature.
user-invocable: false
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Documentation

> Putting on the Technical Writer hat — let's make sure users have clear, reliable guidance for this feature.

## Scope

Feature to document: **{{ key_feature }}**

## Documentation Granularity

Every documentation request has a `Doc Level` sourced from the feature's `A_Core_Spec.md`. Use it to determine the file name, content focus, and section structure. If `Doc Level` is absent or `-`, produce a `Component`-level doc as the default.

| Level | File name | Content focus | Section structure |
|---|---|---|---|
| **Page** | `help/page-<route-name>.html` | "What can I do on this page?" — overview of the view's purpose and available actions | Overview → Key Actions → Tips → Links to embedded Component docs |
| **Component** | `help/component-<component-name>.html` | "How do I use this?" — step-by-step guidance for the specific UI element | Purpose → Step-by-step → Field/Option reference → Notes & Warnings |
| **Concept** | `help/concept-<topic-name>.html` | "What does this mean?" — definition, context, and examples for a term or setting | Definition → Why it matters → Examples → Related concepts |

Page-level docs may link to their embedded Component docs. Concept docs are standalone and may be referenced from multiple pages or components.

## Stages

Do not skip or reorder.

### 1. Research
Gather everything known about the feature: its component spec in `./SPECS/components/`, its implementation in `./src/`, and any existing documentation. Understand the user-facing behavior end-to-end before writing anything.

### 2. Draft
Create the documentation as an HTML page using Bootstrap 5 (CDN: `https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css`) for consistent layout and readability.

**Audience:** Write for the primary end-user of the feature. If the feature is user-facing (UI/UX), target non-technical end-users. If the feature is an API, background process, or operator function, target developers or operators. Match vocabulary and assumed knowledge accordingly.

Include: feature overview, step-by-step usage instructions (or integration guide for developer-facing features), and any important notes or warnings.

Insert a review-status tag at the top of every draft:

    <div style="display:none">
      <table>
        <th><td>Status</td><td>Date</td></th>
        <tr>
          <td>{{ 'Pending Review' | 'In Progress' | 'Approved' | 'Rejected' }}</td>
          <td>{{ MMM DD, YYYY }}</td>
        </tr>
      </table>
    </div>

### 3. Refine
Review the draft for accuracy, clarity, and completeness. Add examples where instructions could be ambiguous. Reorganize sections if needed for better flow. Present the final draft to DevLead for approval — update the review-status tag accordingly.

**Revision loop:** If DevLead rejects the draft, ask for specific feedback (what is inaccurate, unclear, or missing). Incorporate the feedback, update the review-status tag to `In Progress`, and re-present. Repeat until DevLead approves or explicitly defers the document.

## Output

Look up the UI/frontend source directory in `B_Architecture.md` and save to `<frontend_dir>/docs/<feature_name>.html`. If no frontend directory is defined (backend-only project), save to `./docs/<feature_name>.html`. The file name must match the feature identifier used in the component spec.
