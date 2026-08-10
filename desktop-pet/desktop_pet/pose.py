"""What the brain hands to a renderer for a single frame.

Kept separate from both so that creatures and the app agree on a vocabulary
without importing each other.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Particle:
    """A puff of something, in canvas-relative coordinates (0..1)."""

    kind: str  # "flame", "smoke", "heart" or "zzz"
    x: float
    y: float
    vx: float = 0.0  # canvas widths per second
    vy: float = 0.0
    life: float = 1.0  # 1 at birth, 0 at death
    decay: float = 1.0  # life lost per second
    size: float = 1.0


@dataclass
class Pose:
    facing: int = 1  # 1 = right, -1 = left
    squash: float = 1.0  # >1 wide and short, <1 tall and thin
    blink: float = 0.0  # 0 = wide open, 1 = fully shut
    look: tuple[float, float] = (0.0, 0.0)  # eye offset, each in -1..1
    smile: float = 0.5  # 0 = neutral, 1 = delighted, <0 = grumpy
    step: float = 0.0  # gait phase in radians
    wobble: float = 0.0  # idle jiggle phase in radians
    wing: float = 0.0  # wingbeat phase in radians
    lift: float = 0.0  # limbs tuck up while off the ground
    asleep: bool = False
    particles: list[Particle] = field(default_factory=list)
