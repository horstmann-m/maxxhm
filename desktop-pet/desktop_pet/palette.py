"""Colour schemes for the creature.

Tkinter has no alpha channel, so every colour here is a plain opaque hex
string and any "translucent" look (cheeks, shading) is faked by picking a
colour that already sits between the body and the background.
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Palette:
    name: str
    body: str
    belly: str
    outline: str
    eye: str
    shine: str
    cheek: str
    mouth: str
    sprout: str
    shadow: str
    backdrop: str


PALETTES: dict[str, Palette] = {
    "mint": Palette(
        name="mint",
        body="#7fe0c0",
        belly="#b6f2df",
        outline="#2f7f68",
        eye="#22423a",
        shine="#ffffff",
        cheek="#f7a8b8",
        mouth="#2f7f68",
        sprout="#43a06f",
        shadow="#cfe6df",
        backdrop="#eef8f5",
    ),
    "peach": Palette(
        name="peach",
        body="#ffb08a",
        belly="#ffd3bb",
        outline="#a4553a",
        eye="#4a2519",
        shine="#ffffff",
        cheek="#ff7f8f",
        mouth="#a4553a",
        sprout="#5fa35c",
        shadow="#f0dcd2",
        backdrop="#fdf2ec",
    ),
    "lavender": Palette(
        name="lavender",
        body="#bda8f0",
        belly="#dbcefb",
        outline="#5b4595",
        eye="#2e2450",
        shine="#ffffff",
        cheek="#f7a3c8",
        mouth="#5b4595",
        sprout="#6fae86",
        shadow="#ddd6ee",
        backdrop="#f4f0fd",
    ),
    "sky": Palette(
        name="sky",
        body="#8ec9f5",
        belly="#c3e3fb",
        outline="#2d6491",
        eye="#1d3b4a",
        shine="#ffffff",
        cheek="#f7a8b8",
        mouth="#2d6491",
        sprout="#5aa87f",
        shadow="#d3e5f2",
        backdrop="#eff7fd",
    ),
    "sunny": Palette(
        name="sunny",
        body="#ffd76b",
        belly="#ffeaa8",
        outline="#9c6b16",
        eye="#4a3308",
        shine="#ffffff",
        cheek="#ff9b7a",
        mouth="#9c6b16",
        sprout="#6aa84f",
        shadow="#f0e3c4",
        backdrop="#fdf7e6",
    ),
    "slate": Palette(
        name="slate",
        body="#9fb0c4",
        belly="#cbd6e2",
        outline="#43566b",
        eye="#22303d",
        shine="#ffffff",
        cheek="#e79aa5",
        mouth="#43566b",
        sprout="#6f9b7d",
        shadow="#d8dfe7",
        backdrop="#f1f4f8",
    ),
}

NAMES = tuple(PALETTES)


def get(name: str | None) -> Palette:
    """Look up a palette by name; ``None`` or ``"random"`` picks one at random."""
    if not name or name == "random":
        return PALETTES[random.choice(NAMES)]
    try:
        return PALETTES[name.lower()]
    except KeyError:
        raise SystemExit(
            f"unknown palette {name!r} — available: {', '.join(NAMES)}"
        ) from None


def next_after(current: Palette) -> Palette:
    """The next palette in the list, so right-click → colour cycles nicely."""
    order = list(NAMES)
    return PALETTES[order[(order.index(current.name) + 1) % len(order)]]
