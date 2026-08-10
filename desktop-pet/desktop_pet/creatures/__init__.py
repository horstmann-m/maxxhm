"""The creatures you can keep, and what each one emits when it is happy.

A creature is just a ``draw`` function plus a little metadata, so adding one
means writing a module here and adding a line to ``KINDS``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from . import blob, dragon


@dataclass(frozen=True)
class Kind:
    name: str
    draw: Callable
    pet_particle: str  # emitted when you pet it
    sleep_particle: str  # emitted while it sleeps
    sleep_rate: float  # seconds between sleep particles


KINDS: dict[str, Kind] = {
    "dragon": Kind("dragon", dragon.draw, "flame", "smoke", 1.8),
    "blob": Kind("blob", blob.draw, "heart", "zzz", 1.3),
}

NAMES = tuple(KINDS)


def get(name: str | None) -> Kind:
    if not name:
        return KINDS["dragon"]
    try:
        return KINDS[name.lower()]
    except KeyError:
        raise SystemExit(
            f"unknown creature {name!r} — available: {', '.join(NAMES)}"
        ) from None
