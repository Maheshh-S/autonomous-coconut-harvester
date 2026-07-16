from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class SurveyMissionStatus(str, Enum):
    """Lifecycle states for a Survey Mission (see PROJECT_SPECIFICATION.md §7.12).

    ``ACTIVE`` is intentionally NOT a status value: per §7.12 the active mission is
    represented by ``is_active = true`` on a ``COMPLETED`` row, which keeps the
    single-active-row invariant simple.
    """

    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    SUPERSEDED = "SUPERSEDED"
    FAILED = "FAILED"

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(Integer)
    coconut_id = Column(Integer)
    ripeness = Column(String)
    confidence = Column(Float)
    harvest_type = Column(String, nullable=True)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(Integer)
    coconut_id = Column(Integer)
    status = Column(String, default="pending")
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    claimed_at = Column(DateTime, nullable=True)

class Tree(Base):
    __tablename__ = "trees"

    id = Column(Integer, primary_key=True, index=True)
    gps_lat = Column(Float)
    gps_lon = Column(Float)
    detected_time = Column(String)

    # Feature 6 — Permanent Tree Matching & Digital Twin Foundation.
    # ``tree_code`` is the immutable public identifier (TREE-0001, TREE-0002, …).
    # It is write-once; Tree Matching is the only writer (PROJECT_SPECIFICATION.md §11.2, §14).
    tree_code = Column(String, unique=True, nullable=True, index=True)
    first_seen_mission_id = Column(Integer, nullable=True)
    last_seen_mission_id = Column(Integer, nullable=True)
    times_seen = Column(Integer, default=1, nullable=False)
    last_matching_confidence = Column(Float, nullable=True)
    # availability: ACTIVE / MISSING / INACTIVE (§16). Set ACTIVE on every observation.
    availability = Column(String, default="ACTIVE", nullable=False)
    # lifecycle_state: NEW → DETECTED → … (§15). Matching creates a tree in DETECTED.
    lifecycle_state = Column(String, default="DETECTED", nullable=False)
    # Representative detection bounding-box dimensions (pixels) used by the hybrid
    # geometry comparison in Tree Matching; refreshed on each observation.
    last_box_w = Column(Integer, nullable=True)
    last_box_h = Column(Integer, nullable=True)

    # Feature 9 — Inventory Builder & Inventory Snapshot.
    # Pointer to the tree's latest (current) InventorySnapshot (PROJECT_SPECIFICATION.md
    # §13, §17.2). Replaced on every completed inspection; prior snapshots stay in
    # history and are never modified. Plain Integer (no FK) to match this table's
    # existing no-FK convention and to avoid a circular Tree<->InventorySnapshot
    # foreign key at table-creation time.
    current_inventory_id = Column(Integer, nullable=True)

    # Version 2 (v2.0 — Digital Twin Farm Viewer, PROJECT_SPECIFICATION.md §V2.5).
    # Pointer to the tree's representative TreeObservation — the single canonical
    # tile+pixel+bbox chosen by the frozen selection rule (§V2.7). The Tree row
    # itself stays permanent and stores no tile/pixel/bbox metadata; observations
    # live in the mission-scoped ``tree_observations`` history and are never
    # overwritten. Plain Integer (no FK) mirrors ``current_inventory_id`` and
    # avoids a circular Tree<->TreeObservation foreign key at creation time.
    current_observation_id = Column(Integer, nullable=True)


class InspectionStatus(str, Enum):
    """Lifecycle states for a Tree Inspection Session (Feature 7).

    One session is one climbing-robot visit to one permanent tree
    (PROJECT_SPECIFICATION.md §20, Phase 5). The lifecycle is deterministic:

        CREATED → IN_PROGRESS → COMPLETED → FAILED

    ``CREATED`` is set on creation; the robot (or UI) moves it to ``IN_PROGRESS``
    on arrival, then to ``COMPLETED`` (or ``FAILED``) when the visit ends.
    """

    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Inspection(Base):
    """A Tree Inspection Session: one climbing-robot visit to one permanent Tree.

    Introduced in Feature 7 (Tree Inspection Session Foundation). This is the
    first building block of the robot's on-tree work; it deliberately records
    only the session/lifecycle metadata and the inspection history. Coconut
    inventory and ripeness are out of scope here and are not stored.

    ``inspection_code`` is the immutable public identifier (INSP-0001,
    INSP-0002, …), written once from the row id (PROJECT_SPECIFICATION.md §11.2).

    ``tree_id`` has no cascade delete so that deleting a tree can never delete
    its inspection history (PROJECT_SPECIFICATION.md §18): the FK restricts
    deletion of a tree that still has inspections.
    """

    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_code = Column(String, unique=True, nullable=True, index=True)
    tree_id = Column(
        Integer,
        ForeignKey("trees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default=InspectionStatus.CREATED.value, nullable=False)
    inspection_image_count = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    tree = relationship("Tree")


class InspectionImageStatus(str, Enum):
    """Lifecycle states for an Inspection Image (Feature 8).

    An uploaded close-up coconut image flows PENDING → PROCESSING → COMPLETED
    (or FAILED). Processing is idempotent: a COMPLETED image is never processed
    twice (PROJECT_SPECIFICATION.md §22).
    """

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class InspectionImage(Base):
    """One close-up coconut image uploaded for an Inspection Session (Feature 8).

    Each image belongs to exactly one ``Inspection``. The binary is stored on disk
    under ``uploads/inspection/<inspection_id>/`` (mirrors the Survey image storage,
    PROJECT_SPECIFICATION.md §22.2) and processed by the ripeness model.
    """

    __tablename__ = "inspection_images"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(
        Integer,
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    upload_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default=InspectionImageStatus.PENDING.value, nullable=False)

    inspection = relationship("Inspection")
    coconut_detections = relationship(
        "CoconutDetection",
        cascade="all, delete-orphan",
        back_populates="inspection_image",
    )


class CoconutDetection(Base):
    """A temporary coconut detection produced by the ripeness model (Feature 8).

    One detection belongs to exactly one ``InspectionImage``. Per
    PROJECT_SPECIFICATION.md §22.5 each stores only the bounding box, detected
    ripeness class, and confidence — no inventory, no tree/coconut IDs. These rows
    are temporary session data, not the tree's inventory (inventory is out of
    scope here). The class label follows the frozen lowercasing invariant (§22.3).
    """

    __tablename__ = "coconut_detections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_image_id = Column(
        Integer,
        ForeignKey("inspection_images.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    x1 = Column(Integer, nullable=False)
    y1 = Column(Integer, nullable=False)
    x2 = Column(Integer, nullable=False)
    y2 = Column(Integer, nullable=False)
    detected_class = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)

    inspection_image = relationship(
        "InspectionImage", back_populates="coconut_detections"
    )


class InventorySnapshot(Base):
    """A permanent, immutable Coconut Inventory snapshot (Feature 9).

    Each completed Inspection produces exactly **one** InventorySnapshot: the
    aggregated coconut counts built from that inspection's Temporary Coconut
    Detections (PROJECT_SPECIFICATION.md §17, §23). The snapshot is write-once —
    historical snapshots are never modified (§18); a re-scan produces a *new*
    snapshot and the Tree's ``current_inventory_id`` is repointed at it
    (replace-on-scan, §17.2).

    The count fields use the trained ripeness model's own class names
    (``models/coconut_model/data.yaml``: ``Mature``, ``Potential``, ``Premature``),
    stored lowercased to match ``CoconutDetection.detected_class`` (§22.3). This
    keeps aggregation a direct group-by with no lossy remapping; farmer-friendly
    labels are a presentation concern only.

    ``snapshot_code`` is the immutable public identifier (INV-0001, INV-0002, …),
    written once from the row id (§11.2). ``inspection_id`` is UNIQUE so a single
    inspection can own only one snapshot (idempotent rebuilds create no duplicate);
    it is nullable so that a *post-harvest* snapshot written by Robot Mission
    Execution (Feature 11) can carry no originating inspection. The UNIQUE
    constraint permits multiple NULL ``inspection_id`` rows (Postgres treats NULLs
    as distinct), so many harvest snapshots may coexist per tree. ``tree_id`` uses
    ``ondelete="RESTRICT"`` so inventory history survives — a tree with snapshots
    cannot be silently deleted (§18).
    """

    __tablename__ = "inventory_snapshots"
    __table_args__ = (
        UniqueConstraint("inspection_id", name="uq_inventory_inspection"),
    )

    id = Column(Integer, primary_key=True, index=True)
    snapshot_code = Column(String, unique=True, nullable=True, index=True)
    tree_id = Column(
        Integer,
        ForeignKey("trees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    inspection_id = Column(
        Integer,
        ForeignKey("inspections.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_coconuts = Column(Integer, default=0, nullable=False)
    mature_count = Column(Integer, default=0, nullable=False)
    potential_count = Column(Integer, default=0, nullable=False)
    premature_count = Column(Integer, default=0, nullable=False)

    tree = relationship("Tree")
    inspection = relationship("Inspection")


class HarvestMissionStatus(str, Enum):
    """Lifecycle states for a Harvest Mission (PROJECT_SPECIFICATION.md §43.2).

    Feature 10 (Harvest Planner & Mission Builder) only *builds* missions; it does
    not execute the robot. A freshly generated mission is therefore ``CREATED``.
    The remaining states (``RUNNING`` / ``PAUSED`` / ``COMPLETED`` / ``CANCELLED``)
    are defined here to match the frozen state machine, but execution/transitions
    are out of scope for this feature.

    ``CREATED`` / ``RUNNING`` / ``PAUSED`` are the *active* (non-terminal) states:
    a tree assigned to a mission in any of these cannot be assigned to a new one
    (no duplicate assignment — §38, §40).
    """

    CREATED = "CREATED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# Active (non-terminal) mission states. A tree already belonging to a mission in
# one of these states is excluded from new missions (no duplicate assignment).
ACTIVE_HARVEST_MISSION_STATUSES = (
    HarvestMissionStatus.CREATED.value,
    HarvestMissionStatus.RUNNING.value,
    HarvestMissionStatus.PAUSED.value,
)


class HarvestMissionItemStatus(str, Enum):
    """Lifecycle states for a single Harvest Mission Item (PROJECT_SPECIFICATION.md §42.3, §43).

    One item = one tree to visit. The lifecycle is driven by Robot Mission
    Execution (Feature 11):

        PENDING → IN_PROGRESS → COMPLETED   (or FAILED)

    Only one item may be ``IN_PROGRESS`` at any moment. ``COMPLETED`` is reached
    when the robot finishes harvesting the tree (which also writes a post-harvest
    Inventory Snapshot); ``FAILED`` is reserved for a robot fault report (§47) and
    is not produced by the manual execution controls. ``CANCELLED`` is set when
    the mission is cancelled (§46.3) or when an item is invalid/skipped.
    """

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class HarvestMission(Base):
    """An immutable Harvest Mission produced by the Harvest Planner (Feature 10).

    The planner reads each eligible tree's *latest* Inventory Snapshot, orders the
    trees with the frozen Nearest-Neighbour heuristic (§41), and emits one mission
    with one ``HarvestMissionItem`` per tree (§38, §43). The mission never stores a
    tree list inline — the ordered trees live only as child items (§42), so the
    mission row stays a compact, immutable header.

    ``mission_code`` is the write-once public identifier (HM-0001, HM-0002, …),
    derived from the row id (§11.2). A generated mission is ``CREATED``; this
    feature does not execute or mutate it. Repeated generation always creates an
    independent new mission (no reuse, no mutation).

    ``harvest_type`` is one of ``mature`` / ``potential`` / ``premature`` / ``all``
    (the ripeness classes frozen in Feature 9 plus the all-inventory option, §24).
    """

    __tablename__ = "harvest_missions"

    id = Column(Integer, primary_key=True, index=True)
    mission_code = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(
        String, default=HarvestMissionStatus.CREATED.value, nullable=False
    )
    harvest_type = Column(String, nullable=False)
    total_trees = Column(Integer, default=0, nullable=False)
    total_expected_coconuts = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    items = relationship(
        "HarvestMissionItem",
        back_populates="mission",
        order_by="HarvestMissionItem.visit_order",
    )


class HarvestMissionItem(Base):
    """One ordered stop in a Harvest Mission: exactly one tree to visit (Feature 10).

    Each item belongs to one ``HarvestMission`` and references one permanent Tree.
    ``visit_order`` is the 1-based position in the Nearest-Neighbour route (§41);
    ``expected_coconuts`` is how many of the requested harvest type the tree's
    latest Inventory Snapshot reports. There is exactly one row per tree per
    mission (a tree never appears twice in one mission).

    After creation the *route* (``visit_order`` + ``tree_id``) is immutable, but
    the ``status`` is advanced by Robot Mission Execution (Feature 11): progress
    flows PENDING → IN_PROGRESS → COMPLETED, never reordering the queue. Exactly
    one item is IN_PROGRESS at a time. ``tree_id`` uses ``ondelete="RESTRICT"``
    so a tree referenced by a mission cannot be silently deleted (audit/history
    preservation, §18).
    """

    __tablename__ = "harvest_mission_items"
    __table_args__ = (
        # One row per (mission, tree): a tree can never appear twice in a mission.
        UniqueConstraint("mission_id", "tree_id", name="uq_harvest_item_mission_tree"),
    )

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(
        Integer,
        ForeignKey("harvest_missions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tree_id = Column(
        Integer,
        ForeignKey("trees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    visit_order = Column(Integer, nullable=False)
    expected_coconuts = Column(Integer, default=0, nullable=False)
    # Coconuts actually harvested from this tree at completion time (Feature 11).
    # Equals ``expected_coconuts`` for the current F11 slice; reserved for future
    # field-verified yields. Written once when the item reaches COMPLETED.
    harvested = Column(Integer, nullable=True)
    status = Column(
        String, default=HarvestMissionItemStatus.PENDING.value, nullable=False
    )

    mission = relationship("HarvestMission", back_populates="items")
    tree = relationship("Tree")


# ---------------------------------------------------------------------------
# Version 3 — Robot Domain (V3.1 Robot Domain Foundation).
#
# These are the *persisted* robot entities. Per PROJECT_SPECIFICATION.md Appendix A
# (FROZEN) and ROBOT_ARCHITECTURE.md, the robot is a singleton simulator living in
# the same farm-pixel coordinate space as the Digital Twin (no SLAM, no GPS
# localiser). RobotTelemetry / RobotEvent are intentionally NOT created here — they
# belong to the V3.4 Telemetry milestone (see "Do not add telemetry" in the V3.1
# scope). RobotTask / RobotMission are adapters over HarvestMissionItem /
# HarvestMission and are not tables.
# ---------------------------------------------------------------------------


class RobotState(str, Enum):
    """Authoritative robot lifecycle state (PROJECT_SPECIFICATION.md §A.3 / §26 / §45.1).

    The 7 active states plus ``DOCKED`` (a battery sub-state, not an error). The
    *transitions* are enforced by ``RobotController`` in the V3.3 State Machine
    milestone; V3.1 only stores and resets this value. ``IDLE`` is the default.
    """

    IDLE = "IDLE"
    MOVING = "MOVING"
    CLIMBING = "CLIMBING"
    SCANNING = "SCANNING"
    HARVESTING = "HARVESTING"
    RETURNING = "RETURNING"
    ERROR = "ERROR"
    DOCKED = "DOCKED"


class RobotBatteryStatus(str, Enum):
    """Charge state of the robot battery (PROJECT_SPECIFICATION.md §A.5.2)."""

    CHARGING = "CHARGING"
    DISCHARGING = "DISCHARGING"
    IDLE = "IDLE"


# Default farm-pixel position of the home dock. The robot starts docked here.
DEFAULT_DOCK_X = 0.0
DEFAULT_DOCK_Y = 0.0
DEFAULT_ROBOT_SPEED = 1.0
DEFAULT_ROBOT_MAX_SPEED = 5.0
DEFAULT_BATTERY_LOW_THRESHOLD = 20.0
DEFAULT_BATTERY_CRITICAL_THRESHOLD = 5.0


class Robot(Base):
    """The single simulated harvesting robot's identity + live state (singleton).

    Exactly one row exists. ``position_x`` / ``position_y`` are farm-pixel
    coordinates (reuse of the V2 ``computeMosaicLayout`` space, Decision 6). The
    robot begins at the dock, ``IDLE``, fully charged, with no mission or task.
    """

    __tablename__ = "robots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Harvester-01", nullable=False)
    status = Column(String, default=RobotState.IDLE.value, nullable=False)
    position_x = Column(Float, default=DEFAULT_DOCK_X, nullable=False)
    position_y = Column(Float, default=DEFAULT_DOCK_Y, nullable=False)
    heading_deg = Column(Float, default=0.0, nullable=False)
    current_mission_id = Column(Integer, nullable=True)
    current_task_id = Column(Integer, nullable=True)
    # Current operator-set traversal speed (farm-pixels per sim-second). Clamped to
    # [0, RobotConfiguration.max_speed] by the ``/robot/speed`` endpoint.
    speed = Column(Float, default=DEFAULT_ROBOT_SPEED, nullable=False)
    battery_id = Column(Integer, nullable=True)
    dock_id = Column(Integer, nullable=True)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class DockStation(Base):
    """Fixed home / charging point for the robot (singleton)."""

    __tablename__ = "dock_stations"

    id = Column(Integer, primary_key=True, index=True)
    farm_x = Column(Float, default=DEFAULT_DOCK_X, nullable=False)
    farm_y = Column(Float, default=DEFAULT_DOCK_Y, nullable=False)
    label = Column(String, default="Home Dock", nullable=False)


class RobotBattery(Base):
    """Charge state of the robot (one row per robot, one-to-one).

    Drains while active and recharges at the dock (V3.6). V3.1 only seeds it to
    100% and restores it via ``/robot/recharge``; the drain/recharge model is
    applied by the Simulation Engine in V3.6.
    """

    __tablename__ = "robot_batteries"

    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(
        Integer,
        ForeignKey("robots.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    pct = Column(Float, default=100.0, nullable=False)
    status = Column(
        String, default=RobotBatteryStatus.IDLE.value, nullable=False
    )
    last_change_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

    robot = relationship("Robot")


class RobotConfiguration(Base):
    """Robot-level tuning / limits (singleton, one row per robot).

    Holds the operator-facing knobs the V3.1 endpoints consult: traversal speed
    limits and the battery thresholds that later drive the DOCKED routing in V3.3.
    """

    __tablename__ = "robot_configurations"

    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(
        Integer,
        ForeignKey("robots.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    default_speed = Column(Float, default=DEFAULT_ROBOT_SPEED, nullable=False)
    max_speed = Column(Float, default=DEFAULT_ROBOT_MAX_SPEED, nullable=False)
    battery_low_threshold = Column(
        Float, default=DEFAULT_BATTERY_LOW_THRESHOLD, nullable=False
    )
    battery_critical_threshold = Column(
        Float, default=DEFAULT_BATTERY_CRITICAL_THRESHOLD, nullable=False
    )

    robot = relationship("Robot")


class RobotStateTransition(Base):
    """Append-only record of a Robot state transition (Version 3.3 State Machine).

    Every legal transition performed by ``RobotStateMachine`` is persisted here with
    its previous state, next state, a free-text ``reason``, and the wall-clock
    ``created_at``. This history is the single source for later telemetry/playback
    (V3.4/V3.7) — the state machine itself stays agnostic of WebSockets and telemetry;
    it only writes these rows. Rows are never mutated.
    """

    __tablename__ = "robot_state_transitions"

    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(
        Integer,
        ForeignKey("robots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_state = Column(String, nullable=False)
    next_state = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    robot = relationship("Robot")


class SurveyMission(Base):
    __tablename__ = "survey_missions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    source_folder = Column(String, nullable=False)
    status = Column(String, default=SurveyMissionStatus.PROCESSING.value, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    tile_count = Column(Integer, default=0, nullable=False)
    processed_count = Column(Integer, default=0, nullable=False)
    base_gps_lat = Column(Float, nullable=True)
    base_gps_lon = Column(Float, nullable=True)


class SurveyImage(Base):
    """One uploaded image belonging to a Survey Mission (Feature 2: ingestion).

    The binary file is stored on disk under ``uploads/survey/<mission_id>/``;
    this row records the metadata and the on-disk filename so the file can be
    served back. ``mission_id`` mirrors the existing convention of plain
    integer relation columns (no FK constraint), consistent with ``Tree`` /
    ``Detection`` / ``Task``.
    """

    __tablename__ = "survey_images"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, nullable=False, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=False, default=0)
    upload_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SurveyTileStatus(str, Enum):
    """Lifecycle states for a Survey Tile (see PROJECT_SPECIFICATION.md §8.5).

    A tile is one georeferenced drone frame from a survey. Processing creates
    and advances these states; this feature only introduces the entity and the
    states, it performs no processing.
    """

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SurveyTile(Base):
    """One Survey Tile: a georeferenced frame tied to a Survey Mission + Image.

    Introduced in Feature 3 as a first-class domain entity. Records are NOT
    created here (that happens in Feature 4); this model only defines the
    storage and lifecycle states.

    ``mission_id`` / ``image_id`` use the repository's plain-integer relation
    convention (no FK constraint), matching ``SurveyImage``. ``grid_row`` /
    ``grid_col`` capture the tile's position in the coverage grid
    (``plantation_position``, PROJECT_SPECIFICATION.md §8.3) and are populated
    when tiles are generated.
    """

    __tablename__ = "survey_tiles"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, nullable=False, index=True)
    image_id = Column(Integer, nullable=False, index=True, unique=True)
    status = Column(String, default=SurveyTileStatus.PENDING.value, nullable=False)
    grid_row = Column(Integer, nullable=True)
    grid_col = Column(Integer, nullable=True)

    # Version 2 (v2.0 — Digital Twin Farm Viewer, PROJECT_SPECIFICATION.md §V2.5,
    # Decision 4). Tile metadata is persisted during survey processing so the twin
    # can lay out the farm-pixel mosaic without recomputing the grid or decoding
    # every image at read time. ``capture_order`` is the tile's position in the
    # capture sequence (from the survey image ordering; NOT the filename after
    # persistence — the DB is the source of truth, §V2.5). ``center_gps_lat`` /
    # ``center_gps_lon`` are the tile-centre coordinate (§V2.4). ``image_width`` /
    # ``image_height`` are the tile image dimensions in pixels. All are nullable so
    # the additive migration is backward-compatible with pre-V2 tile rows.
    capture_order = Column(Integer, nullable=True)
    center_gps_lat = Column(Float, nullable=True)
    center_gps_lon = Column(Float, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class TileDetection(Base):
    """A raw, transient tree detection produced by running YOLO on one SurveyTile.

    Introduced in Feature 5. Each detection belongs to exactly one ``SurveyTile``
    (``survey_tile_id``, plain integer relation, no FK — matches the repo
    convention). Per PROJECT_SPECIFICATION.md §9.3 a detection stores only the
    bounding box (pixel coords) and confidence; no GPS, no permanent Tree ID, no
    matching. Permanent ``Tree`` records are created later by Tree Matching
    (out of scope here).
    """

    __tablename__ = "survey_tile_detections"
    __table_args__ = (
        # Enforce one detection row per (tile, index) within a tile. Reprocessing
        # a tile clears and rewrites its detections, so this also guards against
        # duplicate detections.
        UniqueConstraint(
            "survey_tile_id", "detection_index", name="uq_tile_detection_idx"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    survey_tile_id = Column(Integer, nullable=False, index=True)
    detection_index = Column(Integer, nullable=False, default=0)
    x1 = Column(Integer, nullable=False)
    y1 = Column(Integer, nullable=False)
    x2 = Column(Integer, nullable=False)
    y2 = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TreeObservation(Base):
    """One observation of one permanent Tree during one Survey Mission (Feature V2.1).

    Introduced by the Version 2 Digital Twin Farm Viewer amendment
    (PROJECT_SPECIFICATION.md §V2.5, Decision 2). Each row records where a single
    permanent Tree was seen in a single survey: the survey tile, the tree's pixel
    position and bounding box *in that tile's local pixels* (§V2.4), the detection
    confidence, and the projected GPS. These rows are **mission-scoped and
    historical** — a re-survey adds new observations and never overwrites older
    ones, so the twin can always be rebuilt from history. The permanent ``Tree``
    stays immutable and merely points at its representative observation via
    ``Tree.current_observation_id`` (chosen by the frozen rule in §V2.7).

    Why a child table rather than columns on ``Tree``: a single Tree is observed
    in multiple overlapping tiles (§8.2) and across multiple immutable missions
    (§7.11); storing tile/pixel/bbox on the Tree row would lose that history and
    break mission immutability. This mirrors the ``InventorySnapshot`` pattern
    (immutable history + a ``current_*`` pointer on ``Tree``).

    ``tree_id`` uses ``ondelete="RESTRICT"`` so a tree with observation history
    cannot be silently deleted (§18). ``mission_id`` / ``survey_tile_id`` follow
    the survey domain's plain-integer relation convention (no FK), matching
    ``SurveyTile`` / ``SurveyImage``.

    ``local_pixel_x`` / ``local_pixel_y`` are the bounding-box centroid in tile
    pixels (the tree's pixel position); ``bbox_*`` are the box corners. Both are
    kept so the twin can render the box and pick the tree's anchor point.
    """

    __tablename__ = "tree_observations"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(
        Integer,
        ForeignKey("trees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    mission_id = Column(Integer, nullable=False, index=True)
    survey_tile_id = Column(Integer, nullable=False, index=True)
    local_pixel_x = Column(Float, nullable=False)
    local_pixel_y = Column(Float, nullable=False)
    bbox_x1 = Column(Integer, nullable=False)
    bbox_y1 = Column(Integer, nullable=False)
    bbox_x2 = Column(Integer, nullable=False)
    bbox_y2 = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    gps_lat = Column(Float, nullable=True)
    gps_lon = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tree = relationship("Tree")


