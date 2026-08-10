"""A borderless, always-on-top, ideally see-through window.

Per-pixel transparency is the one genuinely platform-specific part of a
desktop pet:

* Windows -- ``-transparentcolor`` knocks out one chroma colour.
* macOS   -- ``-transparent`` plus the ``systemTransparent`` background.
* Linux/X11 -- Tk cannot request an ARGB visual, so there is no reliable
  per-pixel transparency. We fall back to drawing an opaque rounded card
  (see ``creature.backdrop``) so the window still looks deliberate.
"""

from __future__ import annotations

import platform
import tkinter as tk

CHROMA = "#ff00ff"  # never used by any palette, so it is safe to knock out


class PetWindow:
    def __init__(self, size: int, topmost: bool = True):
        self.size = size
        self.root = tk.Tk()
        self.root.title("desktop pet")
        self.root.overrideredirect(True)
        self.root.resizable(False, False)
        if topmost:
            self.root.attributes("-topmost", True)

        self.transparent = self._enable_transparency()
        background = "systemTransparent" if self._is_mac and self.transparent else CHROMA
        if not self.transparent:
            background = "#f4f4f4"

        self.root.configure(bg=background)
        self.canvas = tk.Canvas(
            self.root,
            width=size,
            height=size,
            bg=background,
            highlightthickness=0,
            bd=0,
        )
        self.canvas.pack()

    @property
    def _is_mac(self) -> bool:
        return platform.system() == "Darwin"

    def _enable_transparency(self) -> bool:
        system = platform.system()
        try:
            if system == "Windows":
                self.root.attributes("-transparentcolor", CHROMA)
                return True
            if system == "Darwin":
                self.root.attributes("-transparent", True)
                return True
        except tk.TclError:
            return False
        return False

    def move_to(self, x: int, y: int) -> None:
        self.root.geometry(f"{self.size}x{self.size}+{int(x)}+{int(y)}")

    def screen_size(self) -> tuple[int, int]:
        return self.root.winfo_screenwidth(), self.root.winfo_screenheight()

    def pointer(self) -> tuple[int, int]:
        return self.root.winfo_pointerxy()
