"""Version 3.4 — Simulation Clock (deterministic, pure time mapping).

The clock converts *wall-clock* time into *simulation* time. It holds no robot
state and never advances the robot; it only answers "what is the current
simulation time, given when we started, how fast we are running, and whether we
are paused".

Design rules (ROBOT_ARCHITECTURE.md §1.1 / §5):
- The **engine** is pure and never reads a clock. ``SimulationClock`` is the only
  place wall-time enters the system, and only the **scheduler** consults it.
- Deterministic: identical ``(start_wall, speed_factor, pause/resume sequence)``
  always yields the same ``sim_now``. No randomness, no drift.
- ``speed_factor`` is operator-set (default 1×). Pause freezes sim time; resume
  continues without a jump (the paused interval is excluded from elapsed time).

The clock is intentionally tiny and side-effect free so it can be unit-tested
without a database or a running server.
"""

from dataclasses import dataclass
from typing import Optional


# Default operator speed-up factor (1× = real time).
DEFAULT_SPEED_FACTOR = 1.0


@dataclass
class SimulationClock:
    """Maps wall-clock time to deterministic simulation time.

    Attributes:
        speed_factor: multiplier applied to wall elapsed time (1× = real time).
        start_wall: wall-clock reference (seconds) when the run began.
        sim_offset: accumulated simulation time (seconds) carried across pauses.
        running: whether sim time is currently advancing.
        _paused_at: wall time captured when paused (internal).
    """

    speed_factor: float = DEFAULT_SPEED_FACTOR
    start_wall: float = 0.0
    sim_offset: float = 0.0
    running: bool = False
    _paused_at: float = 0.0

    # -- lifecycle ---------------------------------------------------------

    def start(self, wall_now: float, speed_factor: Optional[float] = None) -> None:
        """Begin a fresh run at ``wall_now`` (wall seconds)."""
        if speed_factor is not None and speed_factor > 0:
            self.speed_factor = speed_factor
        self.start_wall = wall_now
        self.sim_offset = 0.0
        self.running = True
        self._paused_at = 0.0

    def pause(self, wall_now: float) -> None:
        """Freeze simulation time at ``wall_now``."""
        if not self.running:
            return
        self.sim_offset = self.sim_now(wall_now)
        self.running = False
        self._paused_at = wall_now

    def resume(self, wall_now: float) -> None:
        """Continue simulation time from ``wall_now`` (no time jump)."""
        if self.running:
            return
        # Shift the start reference so the paused interval is excluded: the
        # elapsed wall time that passed while paused does not count.
        self.start_wall = wall_now - (self.sim_offset / self.speed_factor if self.speed_factor else 0.0)
        self.running = True

    def stop(self) -> None:
        """Halt the clock (sim time is meaningless after stop)."""
        self.running = False
        self.start_wall = 0.0
        self.sim_offset = 0.0
        self._paused_at = 0.0

    # -- queries -----------------------------------------------------------

    def sim_now(self, wall_now: float) -> float:
        """Current simulation time in seconds.

        While running: ``sim_offset + (wall_now - start_wall) * speed_factor``.
        While paused: the frozen ``sim_offset``.
        """
        if not self.running:
            return self.sim_offset
        elapsed_wall = wall_now - self.start_wall
        return self.sim_offset + elapsed_wall * self.speed_factor

    def set_speed_factor(self, wall_now: float, speed_factor: float) -> None:
        """Change the run speed without losing accumulated sim time.

        Captures the current ``sim_now`` at ``wall_now`` and re-anchors the start
        reference so simulation time is continuous through the change (no jump).
        """
        if speed_factor <= 0:
            raise ValueError("speed_factor must be positive")
        # Freeze the current sim time, adopt the new factor, and re-anchor the
        # start reference so future sim_now() calls remain continuous.
        self.sim_offset = self.sim_now(wall_now)
        self.speed_factor = speed_factor
        if self.running:
            self.start_wall = wall_now
        else:
            self._paused_at = wall_now

    def elapsed_wall(self, wall_now: float) -> float:
        return wall_now - self.start_wall
