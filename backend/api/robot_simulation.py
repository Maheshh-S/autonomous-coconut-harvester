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
from simulation.config import DEFAULT_SIMULATION_SPEED

router = APIRouter()


@router.get("/robot/simulation/config")
def get_simulation_config():
    """Expose the backend-owned simulation defaults (V3.7.3).

    The frontend initialises its speed control to ``default_speed_factor`` so the
    default lives in exactly one place (the backend) rather than being duplicated.
    """
    return {"default_speed_factor": DEFAULT_SIMULATION_SPEED}


@router.post("/robot/simulation/start")
def start_simulation(
    mission_id: Optional[int] = Query(None),
    speed_factor: float = Query(DEFAULT_SIMULATION_SPEED),
):
    """Begin executing the resolved Harvest Mission's NavigationPlan.

    Builds the immutable navigation plan and starts the deterministic simulation
    thread. ``speed_factor`` scales simulation time vs wall time (default 60×).
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


@router.post("/robot/simulation/return-to-dock")
def return_to_dock():
    """Recall the robot to its home dock (graceful, preserves mission context).

    Transitions the active run to RETURNING and re-targets the route to the dock.
    Contrast with ``stop`` (which halts the run entirely). This is the backend for
    the UI's "Return to Dock" control: the robot drives home, battery state is
    preserved, and the mission's progress remains available until an explicit
    ``stop`` or ``reset``.
    """
    return scheduler.return_to_dock()


@router.get("/robot/simulation")
def get_simulation():
    """Current simulation status: phase, sim time, progress, recent events."""
    return scheduler.status()
