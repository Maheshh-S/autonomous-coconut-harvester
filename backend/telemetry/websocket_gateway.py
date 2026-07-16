"""Version 3.5 — WebSocket Gateway (live telemetry streaming).

The ``WebSocketGateway`` exposes the simulation to live web clients. It subscribes
to the same ``EventBus`` topic as the ``TelemetryService`` and, on every tick,
broadcasts a compact JSON frame (the current robot snapshot + the tick's events)
to every connected WebSocket client.

Discipline (ROBOT_ARCHITECTURE.md §5 / V3.5 scope):
- **Observe only.** The gateway never mutates the robot, navigation, the state
  machine, or the simulation. It cannot start / pause / stop / resume a run; it
  only reads the bus and the scheduler's read-only ``status()``.
- **Multi-client.** Any number of browsers / dashboards may connect; each gets the
  same broadcast. Each new client immediately receives a one-off snapshot so it is
  not blank until the next tick.
- **Graceful disconnect.** A dropped client is removed from the fan-out set; its
  departure never affects the simulation or other clients.
- **Never blocks the producer.** Broadcasting failures are isolated per client.

The gateway is a singleton (``websocket_gateway``) wired to the singleton bus. It
is constructed with a ``status_fn`` (the scheduler's read-only ``status``) so it can
serve an initial snapshot to late joiners.
"""

import asyncio
import json
import logging
from typing import Callable, Set

from fastapi import WebSocket

from simulation.context import SimulationContext, SimulationEvent

from telemetry.event_bus import EventBus, TOPIC_SIM_EVENTS


logger = logging.getLogger(__name__)


def _frame(context, events, status_fn) -> dict:
    """Build the JSON frame broadcast to clients for one tick."""
    status = status_fn() if status_fn else {}
    return {
        "type": "telemetry",
        "sim_time": status.get("sim_time", 0.0),
        "status": status.get("status"),
        "mission_id": status.get("mission_id"),
        "robot": {
            "position": {"x": context.pos_x, "y": context.pos_y},
            "heading_deg": context.heading_deg,
            "speed": context.speed,
            "battery_pct": context.battery_pct,
            "state": context.status,
            "waypoint_index": context.wp_index,
            "waypoint_count": len(context.waypoints),
            "completed_item_ids": list(context.completed_item_ids),
            "finished": context.finished,
        },
        "events": [
            {"type": e.type, "sim_time": e.sim_time, "detail": e.detail}
            for e in events
        ],
        "run": {
            "status": status.get("status"),
            "finished": status.get("finished"),
            "error": status.get("error"),
        },
    }


class WebSocketGateway:
    """Fan-out broadcaster for live robot telemetry over WebSocket."""

    def __init__(self, event_bus: EventBus, status_fn: Callable[[], dict]) -> None:
        self._bus = event_bus
        self._status_fn = status_fn
        self._clients: Set[WebSocket] = set()
        self._subscribed = False
        self._lock = asyncio.Lock()
        # The asyncio event loop. Captured lazily on the first connection (which
        # runs in the loop thread); used to marshal bus callbacks (arriving from
        # the scheduler's daemon thread) back into the loop via call_soon_threadsafe.
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # -- connection lifecycle ----------------------------------------------

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)
        # Capture the running loop so bus callbacks arriving from the scheduler's
        # daemon thread can be marshalled back into the loop safely.
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            self._loop = None
        if not self._subscribed:
            self._bus.subscribe(TOPIC_SIM_EVENTS, self._on_events)
            self._subscribed = True
        # Immediately send a snapshot so the client is not blank until next tick.
        try:
            await websocket.send_json(self._snapshot_frame())
        except Exception as exc:  # client gone before first frame
            logger.warning("WS initial snapshot failed: %s", exc)
            async with self._lock:
                self._clients.discard(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)
        # Do NOT stop the simulation. Disconnecting a viewer is harmless.

    # -- broadcast ----------------------------------------------------------

    def _on_events(self, payload: object) -> None:
        """Bus callback: schedule a broadcast (runs in the producer's thread)."""
        if not isinstance(payload, dict):
            return
        context = payload.get("context")
        events = payload.get("events") or []
        if not isinstance(context, SimulationContext):
            return
        frame = _frame(context, events, self._status_fn)
        # Schedule the async broadcast from the synchronous scheduler thread. The
        # gateway captured the event loop on first connect; call_soon_threadsafe is
        # the correct cross-thread primitive to marshal into the loop.
        loop = self._loop
        if loop is not None:
            loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(self._broadcast(frame))
            )
        # If no loop yet (no client has connected), the frame is dropped; clients
        # that connect later still receive the immediate snapshot in connect().

    def _snapshot_frame(self) -> dict:
        """A frame with no new events, used for an initial late-joiner snapshot."""
        status = self._status_fn() if self._status_fn else {}
        return {
            "type": "snapshot",
            "sim_time": status.get("sim_time", 0.0),
            "status": status.get("status"),
            "mission_id": status.get("mission_id"),
            "robot": {
                "position": {"x": 0.0, "y": 0.0},
                "heading_deg": 0.0,
                "speed": 0.0,
                "battery_pct": 100.0,
                "state": status.get("status"),
                "waypoint_index": 0,
                "waypoint_count": 0,
                "completed_item_ids": [],
                "finished": False,
            },
            "events": [],
            "run": {
                "status": status.get("status"),
                "finished": status.get("finished"),
                "error": status.get("error"),
            },
        }

    async def _broadcast(self, frame: dict) -> None:
        """Send ``frame`` to every connected client, pruning dead ones."""
        async with self._lock:
            targets = list(self._clients)
        dead = []
        for ws in targets:
            try:
                await ws.send_json(frame)
            except Exception as exc:
                logger.warning("WS broadcast to client failed: %s", exc)
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)


# Constructed in main.py with the scheduler's status() injected.
websocket_gateway: WebSocketGateway = None  # type: ignore


def build_websocket_gateway(event_bus: EventBus, status_fn: Callable[[], dict]):
    """Create (once) the singleton ``WebSocketGateway`` bound to ``status_fn``."""
    global websocket_gateway
    if websocket_gateway is None:
        websocket_gateway = WebSocketGateway(event_bus, status_fn)
    return websocket_gateway
