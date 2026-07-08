# Design Specification – Full Pipeline Integration (Minimal Code Changes)

**Date:** 2026-07-08

---

## 1. Overview

We need to integrate the complete end‑to‑end flow (drone image → tree detection → coconut detection → task generation → robot execution) while touching as few existing files as possible. The chosen approach (Approach B) adds a **post‑detect webhook** that decouples detection latency from planning.

---

## 2. New API Endpoint – `POST /plan/from‑trees`

**File:** `backend/api/plan_from_trees.py`

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, validator
from typing import List

from .harvest_planner import generate_tasks_for_tree  # existing planner logic
from ..security import get_current_user  # reuse existing auth dependency

router = APIRouter()

class TreeBox(BaseModel):
    id: int = Field(..., description="Tree index returned by detection")
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float

    @validator("confidence")
    def confidence_range(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("confidence must be between 0 and 1")
        return v

class PlanRequest(BaseModel):
    trees: List[TreeBox]

class TaskInfo(BaseModel):
    task_id: int
    tree_id: int
    status: str

class PlanResponse(BaseModel):
    tasks_created: int
    tasks: List[TaskInfo]

@router.post("/plan/from-trees", response_model=PlanResponse, status_code=201)
async def plan_from_trees(request: PlanRequest, user=Depends(get_current_user)):
    # Filter low‑confidence detections (same threshold as detection endpoint)
    filtered = [t for t in request.trees if t.confidence >= 0.4]
    if not filtered:
        raise HTTPException(status_code=422, detail="No trees meet confidence threshold")

    created = []
    for tb in filtered:
        # The existing planner expects a dict with at least the coordinates.
        # It internally handles duplicate‑task avoidance.
        task = generate_tasks_for_tree({
            "id": tb.id,
            "x1": tb.x1,
            "y1": tb.y1,
            "x2": tb.x2,
            "y2": tb.y2,
            "confidence": tb.confidence,
        })
        if task:
            created.append(task)

    return PlanResponse(
        tasks_created=len(created),
        tasks=[TaskInfo(task_id=t.id, tree_id=t.tree_id, status=t.status) for t in created],
    )
```

*Key points*
- Re‑uses the existing `generate_tasks_for_tree` function from `backend/api/harvest_planner.py`.
- Validates payload via Pydantic; returns a 422 error if nothing passes the confidence filter.
- Keeps authentication identical to other `/drone/*` routes.

---

## 3. Front‑end Changes – `DroneUploader.tsx`

**File:** `frontend/components/DroneUploader.tsx`

```tsx
// Existing import statements …

// After handling the detection response:
const handleDetection = async (file: File) => {
  const detectionResult = await uploadAndDetect(file);
  setDetectionResult(detectionResult);

  // ---- NEW: planning webhook ----
  try {
    const planResp = await fetch('/plan/from-trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trees: detectionResult.trees }),
    });
    if (!planResp.ok) {
      throw new Error(`Planning failed: ${planResp.status}`);
    }
    const planData = await planResp.json();
    toast.success(`${planData.tasks_created} harvesting task(s) created`);
  } catch (e) {
    console.error(e);
    toast.error('Failed to generate harvesting tasks');
  }
};
```

- The UI shows a temporary toast (or any existing notification component) indicating how many tasks were created.
- No layout changes; the new code lives within the existing `handleDetection` flow.

---

## 4. Backend Planner Integration

The planner (`backend/api/harvest_planner.py`) already:
- Receives a tree object.
- Persists a `Task` linked to the tree.
- Checks for existing pending tasks to stay idempotent.

Our wrapper simply converts the detection JSON into the dict shape expected by the planner and calls it synchronously. No additional database migrations are required.

---

## 5. Validation & Error Handling

- **Payload validation** – enforced by Pydantic models (`PlanRequest`).
- **Confidence filter** – mirrors the detection endpoint’s `conf >= 0.4` threshold.
- **Idempotency** – the planner’s internal check prevents duplicate tasks on repeated calls.
- **Logging** – `logger.info("Planning tasks for X trees", extra={"tree_count": len(filtered)})` (add to the router).
- **Error responses** – 400 for malformed JSON, 422 if no valid trees, 500 for unexpected failures.

---

## 6. Testing Strategy

| Layer | Test | Goal |
|------|------|------|
| **Unit** | Test `PlanRequest` validation and confidence filter. | Ensure bad payloads are rejected. |
| **Unit** | Mock `generate_tasks_for_tree` and verify the router returns the correct `tasks_created` count. | Isolate router logic. |
| **Integration** | Spin up a temporary FastAPI test client, POST a realistic detection payload, then query the SQLite DB to confirm `Task` rows exist. | End‑to‑end verification of planner wiring. |
| **Frontend** | Jest test that `fetch('/plan/from-trees')` is called after successful detection and that a toast appears with the correct number. | UI feedback works. |
| **Manual** | Run the dev server (`npm run dev`), upload a sample drone image, watch the detection UI, and confirm a toast shows the created tasks. | Real‑world validation. |

---

## 7. Deployment & Migration Notes

- **No DB migrations** – the schema already supports `Task` rows.
- **Feature flag** (optional) – wrap the second fetch behind `process.env.NEXT_PUBLIC_ENABLE_PLANNING`. This allows us to turn the feature on/off without redeploying code.
- **Rolling deploy** – because the new endpoint is additive and the frontend only calls it after detection succeeds, we can roll out the backend first, then enable the frontend flag.

---

## 8. Open Questions / Decisions

- **Rate limiting** – Do we need a per‑user/per‑IP rate limit on `/plan/from‑trees`? (If the system will be public‑facing.)
- **Task priority** – The planner currently creates tasks with default priority. Should we expose a priority field in the request? (Out of scope for minimal change.)

*If there are any adjustments needed, let me know and we’ll update the spec.*

---

*Spec written by Claude Code – ready for review and commit.*
