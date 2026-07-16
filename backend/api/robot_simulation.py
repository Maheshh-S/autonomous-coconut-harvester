"""Version 3.4 — Robot Simulation Engine API (control only).

These endpoints drive the singleton ``SimulationScheduler``. They do NOT move the
robot, validate transitions, or render anything — they only start / pause /
resume / stop the simulation and report its status. All execution logic lives in
``backend/simulation/``; all business rules (navigation, state machine,
battery) live in the backend. The frontend only visualizes the resulting state.

No WebSocket, no telemetry persistence, no frontend changes in this milestone.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from simulation.scheduler import scheduler

router = APIRouter()


@router.post("/robot/simulation/start")
def start_simulation(
    mission_id: Optional[int] = Query(None),
    speed_factor: float = Query(1.0),
):
    """Begin executing the resolved Harvest Mission's NavigationPlan.

    Builds the immutable navigation plan and starts the deterministic simulation
    thread. ``speed_factor`` scales simulation time vs wall time (default 1×).
    """
    if speed_factor <= 0:
        raise HTTPException(status_code=400, detail="speed_factor must be positive")
    try:
        return scheduler.start(mission_id=mission_id, speed_factor=speed_factor)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/robot/simulation/pause")
def pause_simulation():
    """Freeze simulation time (the robot holds its current state/position)."""
    return scheduler.pause()


@router.post("/robot/simulation/resume")
def resume_simulation():
    """Continue simulation time from where it was paused."""
    return scheduler.resume()


@router.post("/robot/simulation/stop")
def stop_simulation():
    """Stop the run and release the scheduler (robot state is left as-is)."""
    return scheduler.stop()


@router.get("/robot/simulation")
def get_simulation():
    """Current simulation status: phase, sim time, progress, recent events."""
    return scheduler.status()
