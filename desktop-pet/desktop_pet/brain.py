"""The creature's behaviour: physics, moods and what it decides to do next.

This module knows nothing about Tk. It moves a box around a rectangle and
reports how the creature should look; the app layer turns that into a window
position and a drawing.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from enum import Enum


class State(Enum):
    IDLE = "idle"
    WALK = "walk"
    CHASE = "chase"  # ambling toward the mouse pointer out of curiosity
    AIRBORNE = "airborne"
    DRAG = "drag"
    SLEEP = "sleep"


GRAVITY = 1800.0  # px/s^2
WALK_SPEED = 52.0
CHASE_SPEED = 108.0
BOUNCE = 0.34
THROW_DAMPING = 0.55
IDLE_BEFORE_SLEEP = 32.0
CURIOUS_RANGE = 420.0


@dataclass
class World:
    """The rectangle the creature lives in, in screen pixels."""

    left: int
    right: int  # exclusive: the pet's left edge stays below this
    floor: int  # y of the pet's top edge when standing on the ground


class Brain:
    def __init__(self, x: float, y: float, world: World, size: int):
        self.world = world
        self.size = size
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.facing = 1
        self.state = State.IDLE
        self.timer = 1.5
        self.idle_for = 0.0
        self.mood = 0.55  # 0 grumpy .. 1 delighted
        self.squash = 1.0
        self.step = 0.0
        self.wobble = random.uniform(0, math.tau)
        self.blink = 0.0
        self._blink_in = random.uniform(1.5, 5.0)
        self.look = (0.0, 0.0)
        self.grounded = True
        self._pointer = (int(x), int(y))

    # ------------------------------------------------------------------ helpers

    @property
    def centre(self) -> tuple[float, float]:
        return self.x + self.size / 2, self.y + self.size / 2

    def _clamp_to_world(self) -> None:
        if self.x < self.world.left:
            self.x = self.world.left
            self.vx = abs(self.vx) * 0.5
            self.facing = 1
        elif self.x > self.world.right:
            self.x = self.world.right
            self.vx = -abs(self.vx) * 0.5
            self.facing = -1

    # ------------------------------------------------------------------- events

    def wake(self) -> None:
        if self.state is State.SLEEP:
            self.state = State.IDLE
            self.timer = 0.6
        self.idle_for = 0.0

    def pet(self) -> None:
        """Someone clicked without dragging -- a head scratch."""
        self.wake()
        self.mood = min(1.0, self.mood + 0.3)
        self.squash = 1.18
        self.timer = max(self.timer, 0.8)

    def hop(self, power: float = 620.0) -> None:
        self.wake()
        if self.grounded:
            self.vy = -power
            self.squash = 0.86
            self.state = State.AIRBORNE
            self.grounded = False

    def begin_drag(self) -> None:
        self.wake()
        self.state = State.DRAG
        self.vx = self.vy = 0.0
        self.grounded = False

    def drag_to(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def release(self, vx: float, vy: float) -> None:
        self.state = State.AIRBORNE
        self.vx = vx * THROW_DAMPING
        self.vy = vy * THROW_DAMPING
        if abs(self.vx) > 8:
            self.facing = 1 if self.vx > 0 else -1

    def doze_off(self) -> None:
        self.state = State.SLEEP
        self.vx = 0.0
        self.timer = random.uniform(20.0, 50.0)

    # --------------------------------------------------------------------- tick

    def update(self, dt: float, pointer: tuple[int, int]) -> None:
        self.wobble += dt * (2.4 if self.state is not State.SLEEP else 0.9)
        self.mood = max(0.25, self.mood - dt * 0.012)
        self._pointer = pointer
        self._update_blink(dt)
        self._update_look(pointer)

        if self.state is State.DRAG:
            self.squash += (0.92 - self.squash) * min(1.0, dt * 8)
            self.step += dt * 2
            return

        self.timer -= dt
        if self.state is State.SLEEP:
            self._tick_sleep(dt)
        elif self.state in (State.WALK, State.CHASE):
            self._tick_walk(dt, pointer)
        elif self.state is State.IDLE:
            self._tick_idle(dt)

        self._apply_physics(dt)
        self.squash += (self._rest_squash() - self.squash) * min(1.0, dt * 9)

    def _rest_squash(self) -> float:
        breathing = 1.0 + 0.028 * math.sin(self.wobble * 0.9)
        if not self.grounded:
            # Stretch out while moving fast through the air.
            return breathing - min(0.22, abs(self.vy) / 2600.0)
        return breathing

    def _update_blink(self, dt: float) -> None:
        self._blink_in -= dt
        if self._blink_in <= 0:
            self.blink = 1.0
            self._blink_in = random.uniform(1.8, 6.0)
        self.blink = max(0.0, self.blink - dt * 7.0)

    def _update_look(self, pointer: tuple[int, int]) -> None:
        cx, cy = self.centre
        dx = (pointer[0] - cx) / 240.0
        dy = (pointer[1] - cy) / 240.0
        target = (max(-1.0, min(1.0, dx)), max(-1.0, min(1.0, dy)))
        # Ease toward the target so the eyes glide instead of snapping.
        self.look = (
            self.look[0] + (target[0] - self.look[0]) * 0.18,
            self.look[1] + (target[1] - self.look[1]) * 0.18,
        )

    def _tick_idle(self, dt: float) -> None:
        self.idle_for += dt
        self.vx *= math.exp(-6.0 * dt)
        if self.timer > 0:
            return
        if self.idle_for > IDLE_BEFORE_SLEEP and random.random() < 0.7:
            self.doze_off()
            return
        self._choose_activity()

    def _tick_walk(self, dt: float, pointer: tuple[int, int]) -> None:
        speed = CHASE_SPEED if self.state is State.CHASE else WALK_SPEED
        speed *= 0.75 + self.mood * 0.5
        if self.state is State.CHASE:
            target = pointer[0] - self.size / 2
            if abs(target - self.x) < self.size * 0.4:
                self.state = State.IDLE
                self.timer = random.uniform(1.0, 2.5)
                self.mood = min(1.0, self.mood + 0.05)
                return
            self.facing = 1 if target > self.x else -1
        self.vx = self.facing * speed
        self.step += dt * (5.0 + speed / 22.0)
        if self.x <= self.world.left or self.x >= self.world.right:
            self.facing *= -1
        if self.timer <= 0:
            self.state = State.IDLE
            self.timer = random.uniform(0.8, 3.0)

    def _tick_sleep(self, dt: float) -> None:
        self.vx *= math.exp(-8.0 * dt)
        if self.timer <= 0:
            self.state = State.IDLE
            self.idle_for = 0.0
            self.timer = random.uniform(1.0, 2.0)
            self.mood = min(1.0, self.mood + 0.1)

    def _choose_activity(self) -> None:
        pointer_near = abs(self._pointer[0] - self.centre[0]) < CURIOUS_RANGE
        options = [
            (State.IDLE, 3.0),
            (State.WALK, 4.5),
            ("hop", 1.2),
            (State.CHASE, 2.0 if pointer_near else 0.0),
        ]
        pool = [(choice, weight) for choice, weight in options if weight > 0]
        picked = random.choices(
            [choice for choice, _ in pool], weights=[weight for _, weight in pool]
        )[0]

        if picked == "hop":
            self.hop(random.uniform(430.0, 660.0))
            self.timer = random.uniform(0.6, 1.4)
        elif picked is State.WALK:
            self.state = State.WALK
            self.facing = random.choice((-1, 1))
            self.timer = random.uniform(1.4, 4.0)
        elif picked is State.CHASE:
            self.state = State.CHASE
            self.timer = random.uniform(1.5, 3.5)
        else:
            self.state = State.IDLE
            self.timer = random.uniform(1.2, 3.5)

    def _apply_physics(self, dt: float) -> None:
        self.vy += GRAVITY * dt
        self.x += self.vx * dt
        self.y += self.vy * dt
        self._clamp_to_world()

        if self.y >= self.world.floor:
            impact = self.vy
            self.y = self.world.floor
            if impact > 260:
                # Enough of a drop to bounce, and to squish on landing.
                self.vy = -impact * BOUNCE
                self.squash = 1.0 + min(0.42, impact / 2400.0)
                self.grounded = False
                self.state = State.AIRBORNE
            else:
                self.vy = 0.0
                if not self.grounded:
                    self.squash = 1.0 + min(0.3, impact / 2400.0)
                    self.grounded = True
                    if self.state is State.AIRBORNE:
                        self.state = State.IDLE
                        self.timer = random.uniform(0.8, 2.2)
                self.vx *= math.exp(-2.5 * dt)
        else:
            self.grounded = False
            if self.state not in (State.AIRBORNE, State.DRAG):
                self.state = State.AIRBORNE

    # ------------------------------------------------------------------ display

    @property
    def tuck(self) -> float:
        """Legs tuck up a little while the creature is off the ground."""
        return 0.0 if self.grounded else 0.14

    @property
    def smile(self) -> float:
        if self.state is State.SLEEP:
            return 0.25
        return -0.15 + self.mood * 1.15
