"""Version 3.3 — Robot State Machine (backend only).

The ``RobotStateMachine`` owns **every** Robot state transition. It is deliberately
narrow (PROJECT_SPECIFICATION.md Appendix A §A.3 / V3.3 scope):

- it does **not** own timing (no Simulation Clock — V3.6);
- it does **not** own movement (no navigation execution — V3.2/V3.6);
- it does **not** own battery drain (V3.6) or telemetry emission (V3.4);
- it does **not** know about WebSockets.

Its single responsibility is to **validate and perform legal state transitions**
and to **record transition history** (previous state, next state, timestamp,
reason) for later telemetry/playback. The transition set is the frozen explicit
edge list from the V3.3 spec; anything not in that list is rejected.

Determinism (ROBOT_ARCHITECTURE.md §1.1): validation is a pure lookup over a
fixed edge table — identical ``(current, target)`` always yields the same verdict.
History rows use wall-clock ``created_at`` (timing is owned by the caller, not the
machine).
"""

from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import desc

from database.models import Robot, RobotState, RobotStateTransition

# Frozen, explicit transition edges (PROJECT_SPECIFICATION.md §A.3 + V3.3 spec,
# refined by V3.3.1). Each key is a source state; the set is the legal targets.
# ERROR is reachable from every operational state (an operational failure may fault
# the robot at any active step). ERROR itself is a sink that may ONLY recover to
# RETURNING or IDLE (no other recovery path). No implicit or self transitions are
# permitted.
LEGAL_TRANSITIONS: Dict[str, set] = {
    RobotState.DOCKED.value: {RobotState.IDLE.value, RobotState.ERROR.value},
    RobotState.IDLE.value: {RobotState.MOVING.value, RobotState.ERROR.value},
    RobotState.MOVING.value: {
        RobotState.CLIMBING.value,
        RobotState.RETURNING.value,
        RobotState.ERROR.value,
    },
    RobotState.CLIMBING.value: {RobotState.SCANNING.value, RobotState.ERROR.value},
    RobotState.SCANNING.value: {RobotState.HARVESTING.value, RobotState.ERROR.value},
    RobotState.HARVESTING.value: {
        RobotState.MOVING.value,
        RobotState.ERROR.value,
    },
    RobotState.RETURNING.value: {
        RobotState.DOCKED.value,
        RobotState.ERROR.value,
    },
    RobotState.ERROR.value: {
        RobotState.RETURNING.value,
        RobotState.IDLE.value,
    },
}


def legal_targets(current: str) -> List[str]:
    """The frozen set of states ``current`` may legally transition to."""
    return sorted(LEGAL_TRANSITIONS.get(current, set()))


def is_legal(current: str, target: str) -> bool:
    """Pure validator: is ``current`` → ``target`` a legal transition?"""
    return target in LEGAL_TRANSITIONS.get(current, set())


def _now() -> datetime:
    return datetime.utcnow()


class RobotStateMachine:
    """Owns Robot state transitions and their history.

    Stateless w.r.t. timing/movement. Given a ``Robot`` row and a target state it
    validates the transition, mutates ``robot.status`` on success, and appends a
    ``RobotStateTransition`` history row. Raises ``IllegalTransition`` for any
    transition not in ``LEGAL_TRANSITIONS``.
    """

    def __init__(self, robot: Robot):
        self.robot = robot

    def available_transitions(self) -> List[str]:
        return legal_targets(self.robot.status)

    def can_transition_to(self, target: str) -> bool:
        return is_legal(self.robot.status, target)

    def transition(
        self, db, target: str, reason: Optional[str] = None
    ) -> RobotStateTransition:
        """Validate and perform ``robot.status`` → ``target``.

        Records the transition in ``robot_state_transitions`` (previous, next,
        reason, timestamp). Raises ``IllegalTransition`` if the edge is not legal.
        """
        current = self.robot.status
        if not is_legal(current, target):
            raise IllegalTransition(
                current=current,
                target=target,
                legal=legal_targets(current),
            )
        record = RobotStateTransition(
            robot_id=self.robot.id,
            previous_state=current,
            next_state=target,
            reason=reason,
            created_at=_now(),
        )
        db.add(record)
        self.robot.status = target
        self.robot.updated_at = _now()
        db.commit()
        db.refresh(record)
        return record

    def history(self, db, limit: Optional[int] = None) -> List[RobotStateTransition]:
        """Ordered (oldest → newest) transition history for this robot."""
        q = (
            db.query(RobotStateTransition)
            .filter(RobotStateTransition.robot_id == self.robot.id)
            .order_by(desc(RobotStateTransition.created_at), desc(RobotStateTransition.id))
        )
        if limit is not None:
            q = q.limit(limit)
        return list(reversed(q.all()))


class IllegalTransition(ValueError):
    """Raised when a requested transition is not in the frozen legal set."""

    def __init__(self, current: str, target: str, legal: List[str]):
        self.current = current
        self.target = target
        self.legal = legal
        super().__init__(
            f"Illegal transition {current} -> {target}. "
            f"Legal targets from {current}: {legal or '[]'}"
        )
