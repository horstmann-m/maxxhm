"""Colour schemes, and the small colour maths the creatures use.

Tkinter has no alpha channel, so every colour here is a plain opaque hex
string. Shading, glows and "translucent" membranes are produced by mixing
colours up front with :func:`mix` rather than by compositing.

Each palette declares the creature it was designed for. ``--palette random``
picks within the current creature's family; naming one explicitly always
works, whatever you are running.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

# --------------------------------------------------------------- colour maths


def _to_rgb(colour: str) -> tuple[int, int, int]:
    value = colour.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def mix(a: str, b: str, t: float) -> str:
    """Blend two hex colours; ``t=0`` is all *a*, ``t=1`` is all *b*."""
    t = max(0.0, min(1.0, t))
    ra, ga, ba = _to_rgb(a)
    rb, gb, bb = _to_rgb(b)
    return "#%02x%02x%02x" % (
        round(ra + (rb - ra) * t),
        round(ga + (gb - ga) * t),
        round(ba + (bb - ba) * t),
    )


def darken(colour: str, amount: float) -> str:
    return mix(colour, "#000000", amount)


def lighten(colour: str, amount: float) -> str:
    return mix(colour, "#ffffff", amount)


# ------------------------------------------------------------------- palettes


@dataclass(frozen=True)
class Palette:
    name: str
    family: str  # the creature this was designed for
    body: str
    belly: str
    outline: str
    eye: str
    shine: str
    shadow: str
    backdrop: str
    # Used by the dragon
    horn: str = "#e8dcc8"  # horns, claws, spines
    membrane: str = "#c2562f"  # wing membrane
    ember: str = "#ff7a2f"  # eye glow, fire, breath
    # Used by the blob
    cheek: str = "#f7a8b8"
    mouth: str = "#333333"
    sprout: str = "#43a06f"

    tags: tuple[str, ...] = field(default_factory=tuple)


PALETTES: dict[str, Palette] = {
    # -- dragon ------------------------------------------------------------
    "ember": Palette(
        name="ember",
        family="dragon",
        body="#4c4654",
        belly="#d9a05b",
        outline="#1d1a22",
        eye="#ffcf5c",
        shine="#fff6e2",
        shadow="#ded7cd",
        backdrop="#f6f1ea",
        horn="#ece0c9",
        membrane="#c2562f",
        ember="#ff7a2f",
    ),
    "storm": Palette(
        name="storm",
        family="dragon",
        body="#37536c",
        belly="#a9cbe3",
        outline="#131f2b",
        eye="#8ce9ff",
        shine="#f2fbff",
        shadow="#d3dee6",
        backdrop="#eff5fa",
        horn="#e2ecf3",
        membrane="#3f7fa6",
        ember="#67dcff",
    ),
    "jade": Palette(
        name="jade",
        family="dragon",
        body="#356b4f",
        belly="#cfe3a6",
        outline="#14301f",
        eye="#ffe066",
        shine="#f7fce9",
        shadow="#d6e0cd",
        backdrop="#f1f7ea",
        horn="#ece4c6",
        membrane="#4f9a5f",
        ember="#a8e86a",
    ),
    "dusk": Palette(
        name="dusk",
        family="dragon",
        body="#4b3a6b",
        belly="#c9b0ec",
        outline="#1e1730",
        eye="#ff92e0",
        shine="#fbf3ff",
        shadow="#ddd5e8",
        backdrop="#f5f1fb",
        horn="#e9dff5",
        membrane="#7b4fa8",
        ember="#d96bff",
    ),
    "bone": Palette(
        name="bone",
        family="dragon",
        body="#b3aa9c",
        belly="#ece5d7",
        outline="#443e36",
        eye="#ff6b5d",
        shine="#fffaf1",
        shadow="#e0dad0",
        backdrop="#f8f5ee",
        horn="#fdf8ec",
        membrane="#8c8276",
        ember="#ff8a5d",
    ),
    # -- blob --------------------------------------------------------------
    "mint": Palette(
        name="mint",
        family="blob",
        body="#7fe0c0",
        belly="#b6f2df",
        outline="#2f7f68",
        eye="#22423a",
        shine="#ffffff",
        shadow="#cfe6df",
        backdrop="#eef8f5",
        cheek="#f7a8b8",
        mouth="#2f7f68",
        sprout="#43a06f",
        ember="#f7a8b8",
    ),
    "peach": Palette(
        name="peach",
        family="blob",
        body="#ffb08a",
        belly="#ffd3bb",
        outline="#a4553a",
        eye="#4a2519",
        shine="#ffffff",
        shadow="#f0dcd2",
        backdrop="#fdf2ec",
        cheek="#ff7f8f",
        mouth="#a4553a",
        sprout="#5fa35c",
        ember="#ff7f8f",
    ),
    "lavender": Palette(
        name="lavender",
        family="blob",
        body="#bda8f0",
        belly="#dbcefb",
        outline="#5b4595",
        eye="#2e2450",
        shine="#ffffff",
        shadow="#ddd6ee",
        backdrop="#f4f0fd",
        cheek="#f7a3c8",
        mouth="#5b4595",
        sprout="#6fae86",
        ember="#f7a3c8",
    ),
    "sky": Palette(
        name="sky",
        family="blob",
        body="#8ec9f5",
        belly="#c3e3fb",
        outline="#2d6491",
        eye="#1d3b4a",
        shine="#ffffff",
        shadow="#d3e5f2",
        backdrop="#eff7fd",
        cheek="#f7a8b8",
        mouth="#2d6491",
        sprout="#5aa87f",
        ember="#f7a8b8",
    ),
    "sunny": Palette(
        name="sunny",
        family="blob",
        body="#ffd76b",
        belly="#ffeaa8",
        outline="#9c6b16",
        eye="#4a3308",
        shine="#ffffff",
        shadow="#f0e3c4",
        backdrop="#fdf7e6",
        cheek="#ff9b7a",
        mouth="#9c6b16",
        sprout="#6aa84f",
        ember="#ff9b7a",
    ),
    "slate": Palette(
        name="slate",
        family="blob",
        body="#9fb0c4",
        belly="#cbd6e2",
        outline="#43566b",
        eye="#22303d",
        shine="#ffffff",
        shadow="#d8dfe7",
        backdrop="#f1f4f8",
        cheek="#e79aa5",
        mouth="#43566b",
        sprout="#6f9b7d",
        ember="#e79aa5",
    ),
}

NAMES = tuple(PALETTES)


def family(name: str) -> tuple[str, ...]:
    """Names of the palettes designed for a given creature."""
    return tuple(key for key, value in PALETTES.items() if value.family == name)


def get(name: str | None, prefer: str = "dragon") -> Palette:
    """Look up a palette; ``None``/``"random"`` picks within *prefer*'s family."""
    if not name or name == "random":
        return PALETTES[random.choice(family(prefer) or NAMES)]
    try:
        return PALETTES[name.lower()]
    except KeyError:
        raise SystemExit(
            f"unknown palette {name!r} — available: {', '.join(NAMES)}"
        ) from None


def next_after(current: Palette) -> Palette:
    """The next palette in the same family, so right-click → colour cycles."""
    order = list(family(current.family)) or list(NAMES)
    if current.name not in order:
        return PALETTES[order[0]]
    return PALETTES[order[(order.index(current.name) + 1) % len(order)]]
