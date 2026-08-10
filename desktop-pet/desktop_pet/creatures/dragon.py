"""A baby dragon: big head, small wings, entirely too much confidence.

Drawn facing right and mirrored for the other direction, so every shape below
is written once. All measurements are fractions of the canvas, so the whole
thing scales with ``--size``.

Draw order is back-to-front: far wing, tail, far leg, body, near leg, arm,
ear frill, head, horns, near wing.
"""

from __future__ import annotations

import math

from ..palette import Palette, darken, lighten, mix
from ..pose import Pose

# Wing outline in shoulder-relative units, traced as a perimeter: up the
# leading edge to the wrist, out to each fingertip, dipping back in between
# them for the scalloped trailing edge, then home to the shoulder.
WING = [
    (0.00, 0.00),  # shoulder
    (-0.08, -0.38),  # wrist
    (-0.38, -0.32),  # fingertip 1
    (-0.25, -0.17),
    (-0.44, -0.12),  # fingertip 2
    (-0.23, -0.03),
    (-0.34, 0.09),  # fingertip 3
]
FINGERTIPS = (2, 4, 6)

GROUND = 0.88  # where the feet meet the floor, as a fraction of the canvas


def _flat(points) -> list[float]:
    return [c for point in points for c in point]


def _rotate(points, origin, angle):
    ox, oy = origin
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    return [
        (ox + (x - ox) * cos_a - (y - oy) * sin_a, oy + (x - ox) * sin_a + (y - oy) * cos_a)
        for x, y in points
    ]


def _spike(tip, base_a, base_b):
    """A triangle with a sharpened tip, for horns, spines and claws.

    The tip is repeated because these are drawn with ``smooth=True``: a
    doubled vertex pulls the spline into a point instead of rounding it off.
    """
    return [base_a, tip, tip, base_b]


def _bezier(start, control, end, steps=14):
    points = []
    for i in range(steps + 1):
        t = i / steps
        points.append(
            (
                (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * control[0] + t**2 * end[0],
                (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control[1] + t**2 * end[1],
            )
        )
    return points


def draw(canvas, width: int, height: int, pose: Pose, palette: Palette, backdrop: bool) -> None:
    canvas.delete("all")
    size = min(width, height)
    line = max(1.0, size * 0.015)
    facing = 1 if pose.facing >= 0 else -1
    cx = width * 0.5
    asleep = pose.asleep

    def P(x, y):
        """Local (facing-right) coordinates -> canvas coordinates."""
        return cx + facing * (x - cx), y

    def poly(points, **kwargs):
        canvas.create_polygon(_flat([P(*point) for point in points]), **kwargs)

    def line_(points, **kwargs):
        canvas.create_line(_flat([P(*point) for point in points]), **kwargs)

    def oval(x0, y0, x1, y1, **kwargs):
        (ax, ay), (bx, by) = P(x0, y0), P(x1, y1)
        canvas.create_oval(min(ax, bx), min(ay, by), max(ax, bx), max(ay, by), **kwargs)

    if backdrop:
        inset = line
        canvas.create_polygon(
            _flat(_rounded_rect(inset, inset, width - inset, height - inset, size * 0.16)),
            fill=palette.backdrop, outline=palette.shadow, width=line, smooth=True,
        )

    ground = height * GROUND

    # A sleeping dragon folds down into a wider, lower heap.
    squash = pose.squash * (1.14 if asleep else 1.0)
    rx = size * 0.185 * squash
    ry = size * 0.165 / squash * (0.88 if asleep else 1.0)
    bx = cx - size * 0.02
    by = ground - ry * 1.02 - size * 0.02

    head_r = size * 0.150
    hx = bx + size * (0.185 if not asleep else 0.205)
    hy = by - ry * (1.25 if not asleep else 0.58)

    if backdrop:
        squat = 1.0 - min(0.5, pose.lift * 2)
        canvas.create_oval(
            cx - rx * 1.15 * squat, ground - size * 0.028 * squat,
            cx + rx * 1.15 * squat, ground + size * 0.028 * squat,
            fill=palette.shadow, outline="",
        )

    _wing(poly, line_, size, bx, by, rx, ry, pose, palette, line, asleep, far=True)
    _tail(poly, size, bx, by, rx, ry, pose, palette, line, asleep)
    _legs(oval, poly, size, bx, ground, rx, pose, palette, line, asleep, far=True)
    _body(oval, poly, size, bx, by, rx, ry, palette, line)
    _legs(oval, poly, size, bx, ground, rx, pose, palette, line, asleep, far=False)
    if not asleep:
        _arm(poly, size, bx, by, rx, ry, pose, palette, line)
    _neck(poly, bx, by, rx, ry, hx, hy, head_r, palette)
    _frill(poly, hx, hy, head_r, pose, palette, line, asleep)
    _head(canvas, P, oval, poly, line_, hx, hy, head_r, pose, palette, line, asleep)
    _wing(poly, line_, size, bx, by, rx, ry, pose, palette, line, asleep, far=False)
    _particles(canvas, width, height, size, pose, palette)


def _rounded_rect(x0, y0, x1, y1, r):
    return [
        (x0 + r, y0), (x1 - r, y0), (x1, y0), (x1, y0 + r),
        (x1, y1 - r), (x1, y1), (x1 - r, y1), (x0 + r, y1),
        (x0, y1), (x0, y1 - r), (x0, y0 + r), (x0, y0),
    ]


# ----------------------------------------------------------------------- body


def _body(oval, poly, size, bx, by, rx, ry, palette: Palette, line) -> None:
    oval(bx - rx, by - ry, bx + rx, by + ry,
         fill=palette.body, outline=palette.outline, width=line)

    belly_x = bx + rx * 0.34
    oval(belly_x - rx * 0.52, by - ry * 0.34, belly_x + rx * 0.54, by + ry * 0.88,
         fill=palette.belly, outline="")
    # Scute lines, so the underside reads as segmented armour.
    scute = darken(palette.belly, 0.16)
    for i in range(3):
        y = by - ry * 0.06 + i * ry * 0.30
        w = rx * 0.46 * (1.0 - abs(i - 1) * 0.16)
        poly([(belly_x - w, y), (belly_x, y + ry * 0.10), (belly_x + w, y)],
             fill="", outline=scute, width=line * 0.7, smooth=True)


def _neck(poly, bx, by, rx, ry, hx, hy, hr, palette: Palette) -> None:
    """Fills the gap between body and head so the two read as one animal."""
    poly(
        [
            (bx + rx * 0.10, by - ry * 0.80),
            (hx - hr * 0.72, hy + hr * 0.10),
            (hx + hr * 0.30, hy + hr * 0.86),
            (bx + rx * 0.86, by - ry * 0.30),
        ],
        fill=palette.body, outline="", smooth=True,
    )
    # No ridge along the neck: the head sits close enough to the shoulders
    # that anything drawn between them disappears behind the skull. The
    # spines live on the tail, where there is room for them to read.


def _tail(poly, size, bx, by, rx, ry, pose: Pose, palette: Palette, line, asleep) -> None:
    sway = math.sin(pose.wobble * 0.9) * 0.18
    root = (bx - rx * 0.70, by + ry * 0.40)
    if asleep:
        # Curled around the front, the way a cat parks its tail. It has to
        # hug the base of the body: any lower and it slides under the floor
        # line and gets cut off by the edge of the window.
        control = (bx - rx * 1.15, by + ry * 1.30)
        end = (bx + rx * 1.35, by + ry * 0.80)
    else:
        # Sweeps back and dips to the floor before the tip lifts again, which
        # keeps it clear of the wing and well outside the body silhouette.
        control = (bx - rx * 1.45, by + ry * (1.30 + sway * 0.3))
        end = (bx - rx * 2.05, by + ry * (0.55 + sway))

    spine = _bezier(root, control, end)
    upper, lower = [], []
    for i, (x, y) in enumerate(spine):
        t = i / (len(spine) - 1)
        half = size * 0.055 * (1.0 - t) ** 0.60 + size * 0.005
        ax, ay = (spine[1] if i == 0 else spine[i - 1])
        dx, dy = (x - ax, y - ay) if i else (spine[1][0] - x, spine[1][1] - y)
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        upper.append((x + nx * half, y + ny * half))
        lower.append((x - nx * half, y - ny * half))

    poly(upper + list(reversed(lower)),
         fill=palette.body, outline=palette.outline, width=line, smooth=True)

    # Spines along the outer half of the tail, clear of the body. A curled
    # tail tucks them underneath itself, where they would only read as
    # clutter along the floor, so they sit out the nap entirely.
    for index in () if asleep else (6, 8, 10, 12):
        base = upper[index]
        ahead = upper[index + 1]
        dx, dy = ahead[0] - base[0], ahead[1] - base[1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        # Base width is measured along the tail rather than taken from the
        # gap between samples, so the spines keep their shape wherever the
        # curve happens to be densely or sparsely sampled.
        tx, ty = dx / length, dy / length
        h = size * 0.062 * (1.0 - index / 24)
        half = size * 0.032 * (1.0 - index / 26)
        poly(
            [
                (base[0] - tx * half, base[1] - ty * half),
                (base[0] + nx * h, base[1] + ny * h),
                (base[0] + tx * half, base[1] + ty * half),
            ],
            fill=palette.horn, outline=palette.outline, width=line * 0.55,
        )

    # Fin at the tip.
    tip, prev = spine[-1], spine[-3]
    angle = math.atan2(tip[1] - prev[1], tip[0] - prev[0])
    fin = size * 0.075
    poly(
        _spike((tip[0] + math.cos(angle) * fin * 0.9, tip[1] + math.sin(angle) * fin * 0.9),
               (tip[0] + math.cos(angle + 2.2) * fin, tip[1] + math.sin(angle + 2.2) * fin),
               (tip[0] + math.cos(angle - 2.2) * fin, tip[1] + math.sin(angle - 2.2) * fin)),
        fill=palette.membrane, outline=palette.outline, width=line * 0.7, smooth=True,
    )


def _legs(oval, poly, size, bx, ground, rx, pose: Pose, palette: Palette, line, asleep, far) -> None:
    if asleep:
        # Folded up underneath. Drawing them anyway just scatters claws along
        # the bottom edge of the window.
        return
    foot = size * 0.072
    side = -1 if far else 1
    phase = pose.step + (0.0 if not far else math.pi)
    lift = 0.0 if asleep else max(0.0, math.sin(phase)) * size * 0.045
    swing = 0.0 if asleep else math.cos(phase) * size * 0.030
    fx = bx + side * rx * 0.46 + swing + (size * 0.03 if not far else 0.0)
    fy = ground - lift - pose.lift * size * 0.10

    colour = darken(palette.body, 0.26) if far else palette.body
    oval(fx - foot, fy - foot * 1.25, fx + foot * 1.05, fy + foot * 0.30,
         fill=colour, outline=palette.outline, width=line)
    for claw in (-1, 0, 1):
        tip_x = fx + foot * (0.72 + 0.16 * abs(claw))
        tip_y = fy + foot * (0.24 + 0.10 * claw)
        poly(
            _spike((tip_x + foot * 0.34, tip_y),
                   (tip_x - foot * 0.10, tip_y - foot * 0.16),
                   (tip_x - foot * 0.10, tip_y + foot * 0.16)),
            fill=palette.horn if not far else darken(palette.horn, 0.26),
            outline=palette.outline, width=line * 0.5, smooth=True,
        )


def _arm(poly, size, bx, by, rx, ry, pose: Pose, palette: Palette, line) -> None:
    reach = math.sin(pose.step + 1.2) * size * 0.010
    sx, sy = bx + rx * 0.68, by + ry * 0.06
    poly(
        [
            (sx, sy - size * 0.040),
            (sx + size * 0.070 + reach, sy - size * 0.005),
            (sx + size * 0.066 + reach, sy + size * 0.040),
            (sx - size * 0.010, sy + size * 0.040),
        ],
        fill=palette.body, outline=palette.outline, width=line, smooth=True,
    )
    for claw in (-1, 0, 1):
        tip_x = sx + size * (0.078 + 0.010 * abs(claw)) + reach
        tip_y = sy + size * (0.014 + 0.015 * claw)
        poly(
            _spike((tip_x + size * 0.024, tip_y),
                   (tip_x - size * 0.004, tip_y - size * 0.011),
                   (tip_x - size * 0.004, tip_y + size * 0.011)),
            fill=palette.horn, outline=palette.outline, width=line * 0.5, smooth=True,
        )


# ----------------------------------------------------------------------- wings


def _wing(poly, line_, size, bx, by, rx, ry, pose: Pose, palette: Palette, line, asleep, far) -> None:
    shoulder = (bx - rx * (0.28 if far else 0.06), by - ry * (0.72 if far else 0.86))
    span = size * (0.66 if far else 0.72)
    if asleep:
        beat, span = 1.05, span * 0.62  # folded down along the back
    else:
        # Barely stirring on the ground, beating hard once airborne.
        beat = math.sin(pose.wing) * (0.10 + 0.44 * min(1.0, pose.lift * 7))

    points = _rotate(
        [(shoulder[0] + x * span, shoulder[1] + y * span) for x, y in WING], shoulder, beat
    )
    membrane = darken(palette.membrane, 0.32) if far else palette.membrane
    poly(points, fill=membrane, outline=palette.outline, width=line)

    # Finger bones from the wrist out to each fingertip: the wing reads as
    # skin stretched over a hand, not a sail.
    bone = lighten(membrane, 0.28)
    for index in FINGERTIPS:
        line_([points[1], points[index]], fill=bone, width=line * 0.8, capstyle="round")
    line_([points[0], points[1]], fill=bone, width=line * 0.9, capstyle="round")


# ------------------------------------------------------------------------ head


def _frill(poly, hx, hy, hr, pose: Pose, palette: Palette, line, asleep) -> None:
    flick = 0.0 if asleep else math.sin(pose.wobble * 1.7) * hr * 0.06
    poly(
        [
            (hx - hr * 0.55, hy - hr * 0.34),
            (hx - hr * 1.42, hy - hr * 0.62 + flick),
            (hx - hr * 1.30, hy + hr * 0.06 + flick),
            (hx - hr * 0.50, hy + hr * 0.18),
        ],
        fill=palette.membrane, outline=palette.outline, width=line * 0.8, smooth=True,
    )


def _head(canvas, P, oval, poly, line_, hx, hy, hr, pose: Pose, palette, line, asleep) -> None:
    look_x, look_y = pose.look
    # The head leans slightly toward whatever it is watching.
    hx += look_x * hr * 0.10
    hy += look_y * hr * 0.08

    snout_x, snout_y = hx + hr * 0.74, hy + hr * 0.34
    oval(snout_x - hr * 0.58, snout_y - hr * 0.38, snout_x + hr * 0.54, snout_y + hr * 0.32,
         fill=palette.body, outline=palette.outline, width=line)
    oval(hx - hr, hy - hr * 0.94, hx + hr * 0.94, hy + hr * 0.84,
         fill=palette.body, outline=palette.outline, width=line)

    _horns(poly, hx, hy, hr, palette, line)

    # Brow ridge — the single feature doing most of the work for "cool".
    poly(
        [
            (hx - hr * 0.26, hy - hr * 0.52),
            (hx + hr * 0.88, hy - hr * 0.22),
            (hx + hr * 0.72, hy - hr * 0.02),
            (hx + hr * 0.16, hy - hr * 0.20),
        ],
        fill=darken(palette.body, 0.30), outline="", smooth=True,
    )

    nostril = darken(palette.body, 0.50)
    oval(snout_x + hr * 0.20, snout_y - hr * 0.22, snout_x + hr * 0.36, snout_y - hr * 0.08,
         fill=nostril, outline="")

    droop = hr * (0.12 - 0.20 * max(0.0, pose.smile))
    line_(
        [
            (snout_x - hr * 0.46, snout_y + hr * 0.10),
            (snout_x + hr * 0.02, snout_y + hr * 0.20 + droop),
            (snout_x + hr * 0.46, snout_y + hr * 0.02),
        ],
        fill=palette.outline, width=line, smooth=True, capstyle="round",
    )
    if not asleep and pose.smile > 0.45:
        # A fang shows when it is pleased with itself.
        poly(
            _spike((snout_x + hr * 0.14, snout_y + hr * 0.42),
                   (snout_x + hr * 0.04, snout_y + hr * 0.14),
                   (snout_x + hr * 0.26, snout_y + hr * 0.14)),
            fill=palette.shine, outline=palette.outline, width=line * 0.5,
        )

    _eye(oval, poly, hx, hy, hr, pose, palette, line, asleep)


def _horns(poly, hx, hy, hr, palette: Palette, line) -> None:
    for base, length, width, shade in (
        ((hx - hr * 0.02, hy - hr * 0.86), hr * 1.30, hr * 0.30, 0.0),
        ((hx - hr * 0.52, hy - hr * 0.66), hr * 0.95, hr * 0.24, 0.20),
    ):
        # Swept up and back, with a slight outward curve at the tip.
        tip = (base[0] - length * 0.62, base[1] - length * 0.76)
        poly(
            _spike(tip,
                   (base[0] - width * 0.85, base[1] + width * 0.30),
                   (base[0] + width * 0.75, base[1] - width * 0.10)),
            fill=darken(palette.horn, shade), outline=palette.outline,
            width=line * 0.8, smooth=True,
        )


def _eye(oval, poly, hx, hy, hr, pose: Pose, palette: Palette, line, asleep) -> None:
    ex, ey = hx + hr * 0.34, hy + hr * 0.04
    er = hr * 0.31

    if asleep or pose.blink > 0.7:
        poly([(ex - er, ey - er * 0.15), (ex, ey + er * 0.55), (ex + er, ey - er * 0.25)],
             fill="", outline=palette.outline, width=line * 1.2, smooth=True)
        return

    squint = 1.0 - pose.blink * 0.9
    # Faked glow: a ring of the eye colour blended toward the body, so the eye
    # looks lit without an alpha channel to bloom with.
    halo = mix(palette.eye, palette.body, 0.55)
    oval(ex - er * 1.32, ey - er * 1.32 * squint, ex + er * 1.32, ey + er * 1.32 * squint,
         fill=halo, outline="")
    oval(ex - er, ey - er * squint, ex + er, ey + er * squint,
         fill=palette.eye, outline=palette.outline, width=line * 0.8)

    look_x, look_y = pose.look
    px = ex + look_x * er * 0.34
    py = ey + look_y * er * 0.34 * squint
    oval(px - er * 0.20, py - er * 0.84 * squint, px + er * 0.20, py + er * 0.84 * squint,
         fill=darken(palette.outline, 0.25), outline="")
    oval(px - er * 0.46, py - er * 0.60 * squint, px - er * 0.14, py - er * 0.26 * squint,
         fill=palette.shine, outline="")


# ------------------------------------------------------------------- particles


def _particles(canvas, width, height, size, pose: Pose, palette: Palette) -> None:
    for particle in pose.particles:
        x, y = particle.x * width, particle.y * height
        if particle.kind == "flame":
            # Cools from ember toward pale yellow as it dies.
            colour = mix(palette.ember, "#ffe9a8", max(0.0, particle.life - 0.4))
            r = size * 0.055 * particle.size * (0.5 + particle.life * 0.7)
            canvas.create_polygon(
                x, y - r * 1.6, x + r * 0.75, y + r * 0.3, x, y + r * 0.9, x - r * 0.75, y + r * 0.3,
                fill=colour, outline="", smooth=True,
            )
        elif particle.kind == "smoke":
            # Sleeping breath: a ring that widens and thins as it drifts.
            r = size * 0.05 * particle.size * (1.6 - particle.life)
            colour = mix(darken(palette.backdrop, 0.38), palette.backdrop, 1.0 - particle.life)
            canvas.create_oval(
                x - r, y - r * 0.62, x + r, y + r * 0.62,
                outline=colour, width=max(1.0, size * 0.012 * particle.life), fill="",
            )
        else:
            canvas.create_text(
                x, y, text="♥" if particle.kind == "heart" else "z",
                fill=palette.ember,
                font=("Helvetica", max(7, int(size * 0.13 * particle.size)), "bold"),
            )
