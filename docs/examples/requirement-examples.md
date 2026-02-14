# Requirement Examples (RakDev AI)

Below are illustrative examples showing how to populate the `rakdev-req` snippet.

---
## Snippet Skeleton (After Expansion)
```md
---
id: REQ-2025-4821
status: draft
title: Product catalog age filtering
problem: Parents cannot quickly find age-appropriate products causing drop-offs.
scope:
  in: []
  out: []
metrics:
  - Metric 1
risks: []
---
# Product catalog age filtering

(Body text)
```

---
## Example 1: Age-based product filtering
```md
---
id: REQ-2025-1043
status: draft
title: Age-based product filtering
problem: Users struggle to locate age-appropriate items; current browsing increases time-to-first-click.
scope:
  in:
    - Age range facet on listing pages
    - Age badges on product cards
  out:
    - Personalized ML recommendations
metrics:
  - Reduce product listing bounce rate by 15% in age-focused sessions
  - Increase filter usage adoption to >40% of sessions
risks:
  - Misclassification of ages may reduce trust
  - Too many ranges could clutter UI
---
# Age-based product filtering
Provide age classification mapping rules, fallback handling for missing age data, and analytics events spec.
```

---
## Example 2: Safety certification display
```md
---
id: REQ-2025-2210
status: draft
title: Safety certification display
problem: Parents lack quick visibility of product safety credentials leading to abandoned carts.
scope:
  in:
    - Display CE / ASTM / CPSIA icons on PDP and product cards
    - API extension to return certifications array
  out:
    - Automated third-party certification validation
metrics:
  - +10% conversion on products with certifications
  - <200ms added latency on PDP API
risks:
  - Inconsistent vendor data quality
  - Icon overload reducing clarity
---
# Safety certification display
Define mapping from raw vendor codes to standardized icon set and fallback “Unverified” label.
```

---
## Example 3: Mobile performance baseline (Non-functional)
```md
---
id: REQ-2025-3107
status: draft
title: Mobile performance baseline
problem: Mobile pages exceed acceptable load time harming engagement.
scope:
  in:
    - Measure LCP, INP, CLS for top 10 pages
    - Add performance budget checks in CI
  out:
    - Full front-end redesign
metrics:
  - LCP P75 < 2.5s
  - INP P75 < 200ms
  - CLS P75 < 0.1
risks:
  - Budget enforcement causing build friction
  - Limited device variability in test lab
---
# Mobile performance baseline
Outline instrumentation approach, synthetic vs RUM sources, and escalation thresholds.
```

---
## Filling Guidance
- title: Concise outcome name (avoid “Implement …”).
- problem: User/business pain in one sentence.
- scope.in/out: Concrete inclusions/exclusions preventing scope creep.
- metrics: Measurable success criteria (baseline or target).
- risks: Foreseeable threats; aim for 2–4.
- Body: Additional context, rationale, open questions, links.

---
## Workflow Tips
1. Insert snippet and fill core fields first.
2. Draft metrics early; refine later with analytics input.
3. Keep scope lists parallel (nouns / deliverables, not tasks).
4. Use design document once requirement moves to `review`.
5. Promote to `approved` only when metrics & risks are accepted.

---
_End of examples._
