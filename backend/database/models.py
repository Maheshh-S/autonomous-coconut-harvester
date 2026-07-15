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


