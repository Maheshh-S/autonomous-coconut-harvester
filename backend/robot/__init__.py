"""Version 3.3 — Robot subsystem package (state machine lives here for now).

Later milestones add ``RobotController`` / ``RobotSimulationEngine`` to this
package (PROJECT_SPECIFICATION.md Appendix A). The state machine is the first
inhabitant; it is imported by the V3 domain/state API router.
"""

from robot.state_machine import (
    RobotStateMachine,
    IllegalTransition,
    legal_targets,
    is_legal,
    LEGAL_TRANSITIONS,
)

__all__ = [
    "RobotStateMachine",
    "IllegalTransition",
    "legal_targets",
    "is_legal",
    "LEGAL_TRANSITIONS",
]
