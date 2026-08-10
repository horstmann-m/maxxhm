"""Draws the creature onto a Tk canvas.

Everything is vector shapes computed at draw time, so the pet scales to any
size and there are no sprite sheets to ship. The whole canvas is cleared and
redrawn each frame -- it is only ~20 items, which Tk handles comfortably at
50 fps.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from .palette import Palette


@dataclass
class Pose:
    """Everything the renderer needs to know for a single frame."""

    facing: int = 1  # 1 = right, -1 = left
    squash: float = 1.0  # >1 wide and short, <1 tall and thin
    blink: float = 0.0  # 0 = wide open, 1 = fully shut
    look: tuple[float, float] = (0.0, 0.0)  # pupil offset, each in -1..1
    smile: float = 0.5  # 0 = neutral, 1 = big grin, <0 = frown
    step: float = 0.0  # gait phase in radians
    wobble: float = 0.0  # body jiggle phase in radians
    lift: float = 0.0  # extra vertical offset in body radii (jumping)
    asleep: bool = False
    particles: list["Particle"] = field(default_factory=list)


@dataclass
class Particle:
    kind: str  # "heart" or "zzz"
    x: float  # 0..1 across the canvas
    y: float  # 0..1 down the canvas
    life: float  # 1 at birth, 0 at death
    size: float = 1.0


def _flat(points: list[tuple[float, float]]) -> list[float]:
    return [c for point in points for c in point]


def _blob(cx: float, cy: float, rx: float, ry: float, wobble: float, segments: int = 28):
    """A soft closed shape that breathes -- the body outline."""
    points = []
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        ripple = 1.0 + 0.035 * math.sin(3 * angle + wobble) + 0.02 * math.sin(2 * angle - wobble * 0.7)
        points.append((cx + math.cos(angle) * rx * ripple, cy + math.sin(angle) * ry * ripple))
    return points


def _leaf(cx: float, cy: float, length: float, angle: float):
    """A little pointed leaf, used for the sprout on top of the head.

    Points are repeated at the base and the tip: the polygon is drawn with
    ``smooth=True``, and a doubled vertex pulls the spline into a corner
    instead of rounding it off into a blob.
    """
    tip = (cx + math.cos(angle) * length, cy + math.sin(angle) * length)
    perp = angle + math.pi / 2
    width = length * 0.38
    mid = (cx + math.cos(angle) * length * 0.45, cy + math.sin(angle) * length * 0.45)
    side_a = (mid[0] + math.cos(perp) * width, mid[1] + math.sin(perp) * width)
    side_b = (mid[0] - math.cos(perp) * width, mid[1] - math.sin(perp) * width)
    base = (cx, cy)
    return [base, base, side_a, tip, tip, side_b, base]


def draw(canvas, width: int, height: int, pose: Pose, palette: Palette, backdrop: bool) -> None:
    """Clear and repaint the canvas for this frame."""
    canvas.delete("all")
    size = min(width, height)
    line = max(1.0, size * 0.018)

    if backdrop:
        # Opaque fallback for platforms without per-pixel window transparency:
        # a rounded card so the window reads as a deliberate little terrarium
        # rather than a stray coloured rectangle.
        inset = line
        card = _rounded_rect(inset, inset, width - inset, height - inset, size * 0.16)
        canvas.create_polygon(
            _flat(card), fill=palette.backdrop, outline=palette.shadow, width=line, smooth=True
        )

    cx = width * 0.5
    body_r = size * 0.28
    ground_y = height * 0.87

    rx = body_r * pose.squash
    ry = body_r / pose.squash
    # Sit the body on the ground rather than at a fixed height, so squashing
    # it wide keeps it planted on its feet instead of leaving them behind.
    cy = ground_y - ry * 0.94

    if backdrop:
        # The shadow only makes sense against the card; on a transparent
        # window it would just be a grey smudge floating on the desktop.
        shade = 1.0 - min(0.55, pose.lift * 0.5)
        canvas.create_oval(
            cx - rx * 0.85 * shade,
            ground_y - ry * 0.16 * shade,
            cx + rx * 0.85 * shade,
            ground_y + ry * 0.16 * shade,
            fill=palette.shadow,
            outline="",
        )

    _draw_feet(canvas, cx, ground_y, rx, ry, pose, palette, line)
    _draw_sprout(canvas, cx, cy, ry, size, line * 2, pose, palette, line)

    body = _blob(cx, cy, rx, ry, pose.wobble)
    canvas.create_polygon(
        _flat(body), fill=palette.body, outline=palette.outline, width=line, smooth=True
    )
    # Belly highlight: a smaller blob nudged down and toward the camera.
    canvas.create_oval(
        cx - rx * 0.52,
        cy - ry * 0.02,
        cx + rx * 0.52,
        cy + ry * 0.78,
        fill=palette.belly,
        outline="",
    )

    _draw_face(canvas, cx, cy, rx, ry, pose, palette, line)
    _draw_particles(canvas, width, height, size, pose, palette)


def _rounded_rect(x0: float, y0: float, x1: float, y1: float, r: float):
    return [
        (x0 + r, y0), (x1 - r, y0), (x1, y0), (x1, y0 + r),
        (x1, y1 - r), (x1, y1), (x1 - r, y1), (x0 + r, y1),
        (x0, y1), (x0, y1 - r), (x0, y0 + r), (x0, y0),
    ]


def _draw_feet(canvas, cx, ground_y, rx, ry, pose: Pose, palette: Palette, line: float) -> None:
    foot_rx = rx * 0.30
    foot_ry = ry * 0.17
    spread = rx * 0.48
    for side in (-1, 1):
        # Feet alternate: one lifts while the other plants. A sleeping
        # creature keeps both of them flat on the floor.
        phase = pose.step + (0 if side == pose.facing else math.pi)
        lift = 0.0 if pose.asleep else max(0.0, math.sin(phase)) * ry * 0.22
        swing = 0.0 if pose.asleep else math.cos(phase) * rx * 0.16
        fx = cx + side * spread + swing
        fy = ground_y - lift - pose.lift * ry * 0.9
        canvas.create_oval(
            fx - foot_rx, fy - foot_ry, fx + foot_rx, fy + foot_ry,
            fill=palette.body, outline=palette.outline, width=line,
        )


def _draw_sprout(canvas, cx, cy, ry, size, top_margin, pose: Pose, palette: Palette, line: float) -> None:
    base_y = cy - ry * 0.98
    lean = math.sin(pose.wobble * 0.8) * 0.18 + (0.12 * pose.facing if not pose.asleep else 0.0)
    # Stretching the body tall eats the headroom above the head, so the stem
    # gives way rather than growing off the top of the window.
    headroom = max(0.0, base_y - top_margin)
    stem_len = min(size * 0.15, headroom * 0.62)
    angle = -math.pi / 2 + lean
    tip_x = cx + math.cos(angle) * stem_len
    tip_y = base_y + math.sin(angle) * stem_len
    canvas.create_line(
        cx, base_y, tip_x, tip_y, fill=palette.sprout, width=line * 1.4, capstyle="round", smooth=True
    )
    leaf = _leaf(tip_x, tip_y, min(size * 0.11, max(size * 0.04, headroom - stem_len)), angle + 0.5)
    canvas.create_polygon(
        _flat(leaf), fill=palette.sprout, outline=palette.outline, width=line * 0.7, smooth=True
    )


def _draw_face(canvas, cx, cy, rx, ry, pose: Pose, palette: Palette, line: float) -> None:
    eye_y = cy - ry * 0.12
    eye_dx = rx * 0.34
    eye_r = rx * 0.20
    shift = pose.facing * rx * 0.06
    look_x, look_y = pose.look

    for side in (-1, 1):
        ex = cx + side * eye_dx + shift
        if pose.asleep or pose.blink > 0.72:
            # Closed eye: a gentle downward-curving lash.
            canvas.create_line(
                ex - eye_r, eye_y, ex, eye_y + eye_r * 0.55, ex + eye_r, eye_y,
                fill=palette.eye, width=line * 1.2, smooth=True, capstyle="round",
            )
            continue

        squint = 1.0 - pose.blink * 0.9
        canvas.create_oval(
            ex - eye_r, eye_y - eye_r * squint, ex + eye_r, eye_y + eye_r * squint,
            fill=palette.shine, outline=palette.outline, width=line * 0.8,
        )
        pupil_r = eye_r * 0.55
        px = ex + look_x * (eye_r - pupil_r)
        py = eye_y + look_y * (eye_r - pupil_r) * squint
        canvas.create_oval(
            px - pupil_r, py - pupil_r * squint, px + pupil_r, py + pupil_r * squint,
            fill=palette.eye, outline="",
        )
        glint = pupil_r * 0.42
        canvas.create_oval(
            px - glint + pupil_r * 0.3, py - glint - pupil_r * 0.3,
            px + glint + pupil_r * 0.3, py + glint - pupil_r * 0.3,
            fill=palette.shine, outline="",
        )

    for side in (-1, 1):
        chx = cx + side * rx * 0.66 + shift
        canvas.create_oval(
            chx - rx * 0.15, eye_y + eye_r * 0.9,
            chx + rx * 0.15, eye_y + eye_r * 1.7,
            fill=palette.cheek, outline="",
        )

    mouth_y = eye_y + eye_r * 1.5
    mouth_w = rx * 0.30
    curve = pose.smile * ry * 0.22
    canvas.create_line(
        cx - mouth_w + shift, mouth_y,
        cx + shift, mouth_y + curve,
        cx + mouth_w + shift, mouth_y,
        fill=palette.mouth, width=line * 1.1, smooth=True, capstyle="round",
    )


def _draw_particles(canvas, width, height, size, pose: Pose, palette: Palette) -> None:
    for particle in pose.particles:
        x = particle.x * width
        y = particle.y * height
        if particle.kind == "heart":
            canvas.create_text(
                x, y,
                text="♥",
                fill=palette.cheek,
                font=("Helvetica", max(7, int(size * 0.13 * particle.size)), "bold"),
            )
        else:
            canvas.create_text(
                x, y,
                text="z",
                fill=palette.outline,
                font=("Helvetica", max(7, int(size * 0.14 * particle.size)), "bold"),
            )
