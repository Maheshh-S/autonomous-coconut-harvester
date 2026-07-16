"""Simulated Flight Planner (VERSION 2.8.3).

Source of truth for survey **mission geometry** in the Digital Twin. The Flight
Planner *owns* the farm layout — number of rows, number of columns, the waypoint
traversal pattern, the capture order, the GPS progression, the grid origin, and
the row/column spacing. The uploaded images DO NOT determine the geometry; they
only populate the planned capture positions (VERSION 2.8.3 architecture
refinement).

This replaces the Version 2.8.2 behaviour, where the grid was still *derived* from
the image count via a `ceil(sqrt(n))`/`_choose_grid_shape` heuristic. That removed
empty cells but still tied the mission shape to how many photos were uploaded —
which is not how a real autonomous flight planner behaves. A real planner flies a
*pre-planned* coverage grid; the camera frames are slotted into the planned
positions.

Design (per the approved architecture):

    SimulationFlightPlanner
            │  holds a PlannerConfig (rows, cols, origin,
            │  traversal_pattern, row_spacing, column_spacing)
            ▼
    Waypoints  (rows * cols capture positions, in flown order)
            ▼
    Tile Metadata (grid_row/col, capture_order, centre GPS)
            ▼
    SurveyTile Persistence (done by the caller)
            ▼
    Farm Viewer (renderer unchanged — Version 2 freeze)

Config rules (VERSION 2.8.3):
  * rows / cols are EXPLICITLY configured — never computed from image count.
  * NO sqrt(), NO divisor search, NO nearest-rectangle, NO heuristic factorisation.
  * Fewer images than planned positions  -> populate only the available positions.
  * More images than planned positions    -> fail with a clear validation error
    (never silently invent extra rows/cols).

The default configuration targets the demo dataset (two 10-frame missions) and is
fully deterministic. A real-drone autopilot would supply the same
``PlannerConfig`` contract (or a richer one) — swapping the simulation for live
telemetry is a data-source change, not an architecture change.
"""

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from database.models import SurveyMission, SurveyImage
from api.gps_projection import SPACING_DEG, project_tile_center_gps


class GridOrigin(str, Enum):
    """Which corner the coverage sweep starts from."""

    TOP_LEFT = "TOP_LEFT"
    TOP_RIGHT = "TOP_RIGHT"
    BOTTOM_LEFT = "BOTTOM_LEFT"
    BOTTOM_RIGHT = "BOTTOM_RIGHT"


class TraversalPattern(str, Enum):
    """How waypoints are walked across the grid."""

    BOUSTROPHEDON = "BOUSTROPHEDON"  # lawnmower / snake sweep (§8.3)


class FlightPlannerError(ValueError):
    """Raised when the uploaded images cannot be placed in the planned grid."""


@dataclass(frozen=True)
class PlannerConfig:
    """Explicit, deterministic definition of a survey coverage grid.

    The Flight Planner owns every field here — none is inferred from the image
    count. ``row_spacing`` / ``column_spacing`` are in degrees of latitude /
    longitude (the ground distance between adjacent tile centres). They default to
    the established survey spacing (``SPACING_DEG``, §10) so the spatial spread
    stays internally consistent with the legacy projection.
    """

    rows: int
    cols: int
    origin: GridOrigin = GridOrigin.TOP_LEFT
    traversal_pattern: TraversalPattern = TraversalPattern.BOUSTROPHEDON
    row_spacing: float = SPACING_DEG
    column_spacing: float = SPACING_DEG

    def __post_init__(self) -> None:
        if self.rows <= 0 or self.cols <= 0:
            raise FlightPlannerError(
                f"PlannerConfig requires rows>0 and cols>0, got "
                f"rows={self.rows} cols={self.cols}"
            )


@dataclass
class TilePlacement:
    """Deterministic spatial placement for a single survey image."""

    image_id: int
    capture_order: int  # 1-based, follows the flown waypoint path
    grid_row: int
    grid_col: int
    center_gps_lat: Optional[float]
    center_gps_lon: Optional[float]


@dataclass
class FlightPlan:
    """Result of planning a simulated survey flight for one mission."""

    mission_id: int
    grid_rows: int
    grid_cols: int
    origin: GridOrigin
    pattern: TraversalPattern
    placements: List[TilePlacement]  # ordered by capture_order


# Default coverage grid for the demo dataset (two 10-frame missions). Explicitly
# configured — NOT derived from the image count. Top-left origin, boustrophedon
# sweep, standard survey spacing. Deterministic.
DEFAULT_PLANNER_CONFIG = PlannerConfig(
    rows=5,
    cols=2,
    origin=GridOrigin.TOP_LEFT,
    traversal_pattern=TraversalPattern.BOUSTROPHEDON,
    row_spacing=SPACING_DEG,
    column_spacing=SPACING_DEG,
)


def _waypoint_order(
    rows: int,
    cols: int,
    origin: GridOrigin,
    pattern: TraversalPattern,
) -> List[Tuple[int, int]]:
    """Yield (row, col) cells in flown order for the configured geometry.

    Only ``BOUSTROPHEDON`` is supported (the spec's §8.3 coverage pattern). The
    sweep starts at the configured ``origin`` corner; on alternate rows the
    columns are reversed (classic lawnmower). Geometry (rows/cols) comes from the
    config — this function never derives it.
    """

    if pattern != TraversalPattern.BOUSTROPHEDON:
        raise FlightPlannerError(f"Unsupported traversal pattern: {pattern}")

    # Normalise row/col iteration direction from the origin corner.
    row_indices = list(range(rows))
    if origin in (GridOrigin.BOTTOM_LEFT, GridOrigin.BOTTOM_RIGHT):
        row_indices = list(reversed(row_indices))
    # First row's column direction (subsequent rows reverse).
    forward_first = origin in (GridOrigin.TOP_LEFT, GridOrigin.BOTTOM_LEFT)

    order: List[Tuple[int, int]] = []
    for ri, r in enumerate(row_indices):
        # Even sweep index -> first-row direction; odd -> reversed.
        cols_forward = (ri % 2 == 0) == forward_first
        col_sequence = range(cols) if cols_forward else reversed(range(cols))
        for c in col_sequence:
            order.append((r, c))
    return order


class SimulationFlightPlanner:
    """Simulated autonomous-survey Flight Planner (VERSION 2.8.3).

    Owns the mission geometry via an explicit :class:`PlannerConfig`. Images are
    slotted into the planned capture positions in upload order.
    """

    def __init__(self, config: PlannerConfig = DEFAULT_PLANNER_CONFIG) -> None:
        self.config = config

    def plan(
        self,
        db: Session,
        mission_id: int,
        images: Optional[List[SurveyImage]] = None,
    ) -> FlightPlan:
        """Plan a simulated survey flight for ``mission_id``.

        The grid shape, origin, traversal pattern and spacing all come from
        ``self.config`` — never from the image count. ``images`` populate the
        planned capture positions in ``upload_order``:

        * fewer images than planned positions -> only the available positions are
          filled (the rest of the plan is simply unoccupied);
        * more images than planned positions  -> :class:`FlightPlannerError`
          (no silent extra rows/cols).

        Centre GPS per position is projected by the single §10 projection service
        (``project_tile_center_gps``), honouring the config's row/column spacing.
        """

        mission = (
            db.query(SurveyMission).filter(SurveyMission.id == mission_id).first()
        )
        base_lat = mission.base_gps_lat if mission is not None else None
        base_lon = mission.base_gps_lon if mission is not None else None

        if images is None:
            images = (
                db.query(SurveyImage)
                .filter(SurveyImage.mission_id == mission_id)
                .order_by(SurveyImage.upload_order)
                .all()
            )

        cfg = self.config
        capacity = cfg.rows * cfg.cols
        if len(images) > capacity:
            raise FlightPlannerError(
                f"Mission {mission_id} has {len(images)} images but the planned "
                f"coverage grid is only {cfg.rows}x{cfg.cols} = {capacity} "
                f"positions. Reduce the images or reconfigure the planner grid; "
                f"extra rows/columns are never invented automatically."
            )

        waypoints = _waypoint_order(cfg.rows, cfg.cols, cfg.origin, cfg.traversal_pattern)

        placements: List[TilePlacement] = []
        for idx, image in enumerate(images):
            row, col = waypoints[idx]
            lat, lon = project_tile_center_gps(
                base_lat,
                base_lon,
                row,
                col,
                row_spacing_deg=cfg.row_spacing,
                col_spacing_deg=cfg.column_spacing,
            )
            placements.append(
                TilePlacement(
                    image_id=image.id,
                    capture_order=idx + 1,
                    grid_row=row,
                    grid_col=col,
                    center_gps_lat=lat,
                    center_gps_lon=lon,
                )
            )

        return FlightPlan(
            mission_id=mission_id,
            grid_rows=cfg.rows,
            grid_cols=cfg.cols,
            origin=cfg.origin,
            pattern=cfg.traversal_pattern,
            placements=placements,
        )


# Backwards-compatible entry point used by the survey pipeline. Returns a plan for
# the default configured geometry. Geometry is planner-defined, not image-derived.
def plan_flight(db: Session, mission_id: int) -> FlightPlan:
    return SimulationFlightPlanner().plan(db, mission_id)
