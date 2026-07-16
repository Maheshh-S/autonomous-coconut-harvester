"""Version 3.5 — Telemetry Event Bus (pub/sub decoupling layer).

The ``EventBus`` is the single decoupling point between the **producers** of
simulation events (the ``SimulationEngine`` via the ``SimulationScheduler``) and
the **consumers** (``TelemetryService`` for persistence, ``WebSocketGateway`` for
live streaming). The engine itself never references any consumer — it returns
``SimulationEvent`` objects, the scheduler publishes them onto the bus, and any
number of subscribers react.

Design rules (ROBOT_ARCHITECTURE.md §5):
- Decoupling only: the bus knows nothing about robots, navigation, or the state
  machine. It carries generic ``(topic, payload)`` messages.
- A subscriber failing must never break the producer (exceptions are caught per
  subscriber so one bad consumer cannot stall the simulation tick).
- Publishing is synchronous and ordered: subscribers receive events in the exact
  order the engine produced them, preserving deterministic event ordering.
- The bus holds no robot state; it is a pure relay.

This module is a **singleton** (``event_bus``) shared across the scheduler and the
WebSocket gateway so a single bus serves every connected client.
"""

from typing import Callable, Dict, List


# Topic the simulation publishes its per-tick batches of SimulationEvents on.
TOPIC_SIM_EVENTS = "simulation.events"


class EventBus:
    """Minimal synchronous pub/sub relay.

    Subscribers register a callback for a topic. ``publish`` invokes every
    subscriber for that topic with the payload, isolating subscriber failures.
    """

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[object], None]]] = {}

    def subscribe(self, topic: str, callback: Callable[[object], None]) -> None:
        """Register ``callback(payload)`` for ``topic``.

        A subscriber is added once per (topic, callback identity); re-subscribing
        the same callable is a no-op.
        """
        self._subscribers.setdefault(topic, [])
        if callback not in self._subscribers[topic]:
            self._subscribers[topic].append(callback)

    def unsubscribe(self, topic: str, callback: Callable[[object], None]) -> None:
        """Remove ``callback`` from ``topic`` (no error if absent)."""
        subs = self._subscribers.get(topic)
        if subs and callback in subs:
            subs.remove(callback)

    def publish(self, topic: str, payload: object) -> None:
        """Deliver ``payload`` to every subscriber of ``topic``, in order.

        Subscriber exceptions are caught and swallowed (with a note) so a failing
        consumer can never stall the producer's tick.
        """
        for callback in list(self._subscribers.get(topic, [])):
            try:
                callback(payload)
            except Exception as exc:  # isolate a bad consumer from the producer
                import logging

                logging.getLogger(__name__).warning(
                    "EventBus subscriber for %s raised: %s", topic, exc
                )


# The single bus instance shared by the scheduler (producer) and the WebSocket
# gateway / telemetry service (consumers).
event_bus = EventBus()
