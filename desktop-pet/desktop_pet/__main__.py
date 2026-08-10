"""Command line entry point: ``python -m desktop_pet``."""

from __future__ import annotations

import argparse
import sys

from . import __version__, creatures, palette as palettes


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="desktop_pet",
        description="Set a small creature loose on your desktop.",
    )
    parser.add_argument(
        "--creature",
        default="dragon",
        help=f"which creature to keep: {', '.join(creatures.NAMES)} (default: dragon)",
    )
    parser.add_argument(
        "--size", type=int, default=128, help="creature size in pixels (default: 128)"
    )
    parser.add_argument(
        "--palette",
        default="random",
        help="colour scheme: "
        + ", ".join(palettes.NAMES)
        + " or 'random', which picks one suited to the creature (default: random)",
    )
    parser.add_argument("--fps", type=int, default=50, help="frames per second (default: 50)")
    parser.add_argument(
        "--floor",
        type=int,
        default=48,
        dest="floor_margin",
        help="pixels to keep clear at the bottom of the screen, e.g. for a taskbar "
        "(default: 48)",
    )
    parser.add_argument(
        "--no-topmost",
        action="store_true",
        help="let other windows cover the creature",
    )
    parser.add_argument("--version", action="version", version=f"desktop-pet {__version__}")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.size < 48:
        raise SystemExit("--size below 48 leaves no room for a face")

    # Resolve both before opening a window, so a typo fails with a readable
    # message instead of a Tk error.
    kind = creatures.get(args.creature)
    palette = palettes.get(args.palette, prefer=kind.name)

    from .app import PetApp

    app = PetApp(
        size=args.size,
        creature=kind,
        palette=palette,
        fps=args.fps,
        floor_margin=args.floor_margin,
        topmost=not args.no_topmost,
    )
    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
