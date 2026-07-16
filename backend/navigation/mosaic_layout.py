"""Farm-pixel mosaic layout — backend port of the frontend single source of truth.

PROJECT_SPECIFICATION.md (§V2.4–§V2.6) and Decision 6 establish that **one** pure
function, ``computeMosaicLayout`` (``frontend/lib/mosaicLayout.ts``), owns the
transform from survey tiles to farm-pixel coordinates. Both ``FarmMosaic`` and
``OverlayLayer`` use it so tree boxes never drift from their tiles.

The Version 3 robot navigates in that **same** farm-pixel space (no SLAM, no second
coordinate system — PROJECT_SPECIFICATION.md Appendix A §A.2). To keep a single
source of truth the backend must place tiles with the *identical* algorithm the
frontend uses. This module is a faithful Python port of ``computeMosaicLayout``:
same column/row max-width model, same occupied-bounding-box fit, same ``gap``
handling. It is pure and deterministic — given the same tiles it always yields the
same placement.

Only ``SurveyTile`` geometry is consumed here (``grid_col``, ``grid_row``,
``image_width``, ``image_height``), matching the frontend exactly.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

MIN_TILE = 1
DEFAULT_GAP = 2


@dataclass(frozen=True)
class TileGeometry:
    """Minimal tile geometry needed to place a tile in farm-pixel space."""

    id: int
    grid_col: int
    grid_row: int
    image_width: int
    image_height: int


@dataclass(frozen=True)
class PlacedTile:
    """A tile placed at its farm-pixel top-left ``(x, y)``."""

    id: int
    grid_col: int
    grid_row: int
    x: float
    y: float
    w: float
    h: float


def compute_mosaic_layout(
    tiles: Sequence[TileGeometry], gap: int = DEFAULT_GAP
) -> List[PlacedTile]:
    """Faithful backend port of ``frontend/lib/mosaicLayout.ts::computeMosaicLayout``.

    Places each tile at the cumulative column/row offset of the *occupied* farm
    rectangle (min/max grid col/row), using the per-column max width and per-row
    max height. Deterministic: identical input → identical output.
    """
    if not tiles:
        return []

    col_w: Dict[int, int] = {}
    row_h: Dict[int, int] = {}
    for t in tiles:
        w = max(t.image_width or 0, MIN_TILE)
        h = max(t.image_height or 0, MIN_TILE)
        col_w[t.grid_col] = max(col_w.get(t.grid_col, 0), w)
        row_h[t.grid_row] = max(row_h.get(t.grid_row, 0), h)

    cols = [t.grid_col for t in tiles]
    rows = [t.grid_row for t in tiles]
    min_col, max_col = min(cols), max(cols)
    min_row, max_row = min(rows), max(rows)

    col_x = [0.0] * (max_col + 1)
    x = float(gap)
    for c in range(min_col, max_col + 1):
        col_x[c] = x
        x += col_w.get(c, MIN_TILE) + gap

    row_y = [0.0] * (max_row + 1)
    y = float(gap)
    for r in range(min_row, max_row + 1):
        row_y[r] = y
        y += row_h.get(r, MIN_TILE) + gap

    placed: List[PlacedTile] = []
    for t in tiles:
        w = max(t.image_width or 0, MIN_TILE)
        h = max(t.image_height or 0, MIN_TILE)
        placed.append(
            PlacedTile(
                id=t.id,
                grid_col=t.grid_col,
                grid_row=t.grid_row,
                x=col_x[t.grid_col],
                y=row_y[t.grid_row],
                w=w,
                h=h,
            )
        )
    return placed


def tile_placement_map(
    tiles: Sequence[TileGeometry], gap: int = DEFAULT_GAP
) -> Dict[int, PlacedTile]:
    """``{tile_id: PlacedTile}`` for O(1) lookup during target resolution."""
    return {p.id: p for p in compute_mosaic_layout(tiles, gap)}


def tree_target_pixel(
    placement: Dict[int, PlacedTile],
    survey_tile_id: int,
    local_pixel_x: float,
    local_pixel_y: float,
) -> Optional[tuple]:
    """Farm-pixel target of a tree's representative observation.

    Mirrors ``OverlayLayer``: the tree centroid is the tile's placed top-left plus
    the observation's ``local_pixel_*`` offset within the tile. Returns ``None``
    when the referenced tile is not present in the placement set.
    """
    tile = placement.get(survey_tile_id)
    if tile is None:
        return None
    return (tile.x + local_pixel_x, tile.y + local_pixel_y)
