# Project Seed + Analysis

## 1) Fill project with test data and get analysis

```bash
npx convex run projectDiagnostics:seedAndAnalyzeProject '{
  "projectId": "YOUR_PROJECT_ID",
  "profile": "standard"
}'
```

Profiles:
- `lite`
- `standard`
- `heavy`

Optional:
- `"seedTag": "TEST-PRICING-001"` to mark generated records and analyze only that batch.

## 2) Analyze existing project data (without creating new records)

```bash
npx convex run projectDiagnostics:analyzeProjectData '{
  "projectId": "YOUR_PROJECT_ID"
}'
```

Analyze only one seed batch:

```bash
npx convex run projectDiagnostics:analyzeProjectData '{
  "projectId": "YOUR_PROJECT_ID",
  "seedTag": "TEST-PRICING-001"
}'
```

## Output highlights

You get:
- `counts` (tasks/notes/shopping/labor/contacts/surveys)
- `coverage` (done tasks %, price coverage %, survey question coverage %)
- `budget` (shopping/labor/grand totals)
- `risks` and `examples` (missing prices, overdue tasks)
- `score` (0-100) and actionable `insights`
