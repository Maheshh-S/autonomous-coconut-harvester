"""Version 3.7.3 — Shared simulation configuration.

Single source of truth for the runtime tunables that the simulation scheduler,
the engine's battery model, and the API defaults all consult. Previously the
default ``speed_factor`` was hardcoded as ``1.0`` in several endpoints and the
frontend guessed a default; this module makes the default a single, named,
backend-owned constant so the UI can initialise to it automatically and there is
exactly one place to change behaviour.

Battery calibration (V3.7.3): the drain rate is expressed *per simulation second*
(see ``engine.py``) so it stays deterministic and derived from simulated elapsed
time, never wall-clock. The relationship to real time is fixed by the default
speed factor: at ``DEFAULT_SIMULATION_SPEED``× we want ~1% battery per real
second, so the per-sim-second rate is simply ``1 / DEFAULT_SIMULATION_SPEED``.
Changing the default speed therefore retargets the real-second calibration
automatically — no second hardcoded 60.
"""

# Default simulation speed (sim seconds per real second). The robot now runs at
# 60× by default; selecting 120× is exactly twice as fast. One constant, reused
# by the API defaults and exposed to the frontend via GET /robot/simulation/config.
DEFAULT_SIMULATION_SPEED = 60.0

# Battery drain rate in percentage points per *simulation* second while the robot
# is in an active state. Derived from the default speed so that, at the default
# speed, the robot loses ~1% per real second (1 / 60 per sim-second * 60 sim-seconds
# per real second = 1%). Remains purely a function of simulated elapsed time.
BATTERY_DRAIN_PER_S = 1.0 / DEFAULT_SIMULATION_SPEED
