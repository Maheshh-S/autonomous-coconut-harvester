"""GPS projection service (PROJECT_SPECIFICATION.md §10).

Converts a tile detection's pixel position into a generated latitude/longitude
using the mission base GPS, the tile's position in the coverage grid, and the
detection's offset within the tile. This is the single source of projection
logic: Tree Matching (Feature 6) and the future Farm Digital Twin / Map both
reuse it so the math is never duplicated.

The formula follows §10.2 exactly:

    tile_lat = base_lat + (tile_row * spacing_lat)
    tile_lon = base_lon + (tile_col * spacing_lon)
    box_offset_m = (box_centre_px - image_centre_px) * metres_per_pixel
    tree_lat = tile_lat + offset_m_lat
    tree_lon = tile_lon + offset_m_lon

Constants are derived from the real standard survey altitude and a typical
drone camera FOV (§10.4): ``spacing`` is the ground distance between adjacent
tile centres, and ``metres_per_pixel`` is the ground scale at that altitude.
"""

import math

# Earth radius (metres) for the Haversine great-circle distance.
EARTH_RADIUS_M = 6371000.0

# Metres per degree of latitude (≈ constant everywhere). Used to turn a
# north–south ground offset into a latitude delta.
METRES_PER_DEG_LAT = 111320.0

# Ground distance between adjacent tile centres, expressed in degrees. Chosen to
# match the legacy single-image baseline (GPS_STEP 0.001 ≈ 111 m) so the spatial
# spread is internally consistent with the existing DroneUploader projection.
SPACING_DEG = 0.001

# Ground footprint of one tile (metres) at the standard survey altitude.
TILE_FOOTPRINT_M = SPACING_DEG * METRES_PER_DEG_LAT

# GPS-proximity match radius (metres). Frozen invariant from §11.3: a detection
# within this distance of an existing permanent Tree is treated as an observation
# of that tree. Also used as the Tree Matching candidate-search radius.
DISTANCE_THRESHOLD = 4.0


def gps_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two GPS points in metres (Haversine)."""

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_M * c


def project_tile_center_gps(
    base_lat: float,
    base_lon: float,
    tile_row: int,
    tile_col: int,
    row_spacing_deg: float = SPACING_DEG,
    col_spacing_deg: float = SPACING_DEG,
) -> tuple[float, float]:
    """Project a tile's *centre* to a generated (lat, lon).

    This is the ``project_detection_gps`` formula evaluated at the image centre,
    where the intra-tile pixel offset is zero — so it depends only on the mission
    base coordinate and the tile's grid position. Kept here (single source, §10)
    so tile metadata persistence and the Digital Twin never re-derive the spacing.

    ``row_spacing_deg`` / ``col_spacing_deg`` allow the Flight Planner (VERSION
    2.8.3) to override the default ground distance between adjacent tile centres;
    they default to ``SPACING_DEG`` so existing callers are unchanged.
    """

    return base_lat + (tile_row * row_spacing_deg), base_lon + (
        tile_col * col_spacing_deg
    )


def project_detection_gps(
    base_lat: float,
    base_lon: float,
    tile_row: int,
    tile_col: int,
    img_w: int,
    img_h: int,
    box_cx: float,
    box_cy: float,
) -> tuple[float, float]:
    """Project a detection's box centre to a generated (lat, lon).

    ``box_cx`` / ``box_cy`` are the detection bounding-box centre in original
    image pixels. ``img_w`` / ``img_h`` are the original image dimensions.
    Deterministic: identical inputs always yield identical coordinates.
    """

    tile_lat = base_lat + (tile_row * SPACING_DEG)
    tile_lon = base_lon + (tile_col * SPACING_DEG)

    # Ground scale (metres per pixel) derived from the tile footprint and the
    # actual image width; a square-ish assumption keeps the formula simple.
    metres_per_pixel = TILE_FOOTPRINT_M / max(img_w, 1)

    off_x_m = (box_cx - img_w / 2.0) * metres_per_pixel
    off_y_m = (box_cy - img_h / 2.0) * metres_per_pixel

    off_lat = off_y_m / METRES_PER_DEG_LAT
    # East–west metres convert to degrees via cos(latitude) (longitude converges
    # towards the poles).
    off_lon = off_x_m / (METRES_PER_DEG_LAT * math.cos(math.radians(tile_lat)))

    return tile_lat + off_lat, tile_lon + off_lon
