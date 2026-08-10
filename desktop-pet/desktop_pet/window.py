"""A borderless, always-on-top, ideally see-through window.

Per-pixel transparency is the one genuinely platform-specific part of a
desktop pet:

* Windows -- ``-transparentcolor`` knocks out one chroma colour.
* macOS   -- ``-transparent`` plus the ``systemTransparent`` background,
  on Tk 8.6 and up (including Tk 9). Apple's own system Tk is still 8.5.9,
  where borderless transparent windows are unreliable enough that we do not
  try; if the colour name is rejected we fall back rather than crash.
* Linux/X11 -- Tk cannot request an ARGB visual, so there is no reliable
  per-pixel transparency. We fall back to drawing an opaque rounded card
  (see the creatures' ``backdrop`` mode) so the window still looks
  deliberate.

``plain=True`` drops the borderless window entirely and uses an ordinary
titled one. It is the escape hatch when a platform will not cooperate: a
normal window always shows up, and always has a close button.
"""

from __future__ import annotations

import platform
import tkinter as tk

CHROMA = "#ff00ff"  # never used by any palette, so it is safe to knock out
OPAQUE = "#f4f4f4"


class PetWindow:
    def __init__(
        self,
        size: int,
        topmost: bool = True,
        plain: bool = False,
        allow_transparency: bool = True,
    ):
        self.size = size
        self.plain = plain
        self.root = tk.Tk()
        self.root.title("desktop pet")
        self.root.resizable(False, False)
        if not plain:
            self.root.overrideredirect(True)
        if topmost:
            # Plain windows need this too. Without it the fallback opens
            # behind whatever you launched it from -- usually a terminal
            # sitting exactly where the pet spawns.
            self.root.attributes("-topmost", True)

        self.transparent = (
            self._enable_transparency() if allow_transparency and not plain else False
        )
        if self.transparent:
            background = "systemTransparent" if self._is_mac else CHROMA
        else:
            background = OPAQUE

        try:
            self.root.configure(bg=background)
        except tk.TclError:
            # The window attribute was accepted but the matching colour name
            # was not -- macOS names in particular have moved between Tk
            # releases. An opaque pet beats a traceback.
            self.transparent = False
            background = OPAQUE
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

    # ------------------------------------------------------------------ probing

    @property
    def _is_mac(self) -> bool:
        return platform.system() == "Darwin"

    @property
    def tk_patchlevel(self) -> str:
        return str(self.root.tk.call("info", "patchlevel"))

    @property
    def _tk_version(self) -> tuple[int, ...]:
        try:
            return tuple(int(part) for part in self.tk_patchlevel.split(".")[:2])
        except ValueError:
            return (0, 0)

    @property
    def legacy_aqua_tk(self) -> bool:
        """Apple's system Tk 8.5, too old to be trusted with transparency.

        Anything from 8.6 up -- including Tk 9 -- is fine, so the check is a
        floor rather than an equality test.
        """
        return self._is_mac and self._tk_version < (8, 6)

    def _enable_transparency(self) -> bool:
        system = platform.system()
        try:
            if system == "Windows":
                self.root.attributes("-transparentcolor", CHROMA)
                return True
            if system == "Darwin":
                if self.legacy_aqua_tk:
                    # 8.5.9 accepts the attribute and then renders the window
                    # unpredictably. An opaque card is worth more than a pet
                    # you cannot find.
                    return False
                self.root.attributes("-transparent", True)
                return True
        except tk.TclError:
            return False
        return False

    def raise_to_front(self) -> None:
        """Make sure the window is actually on screen and on top."""
        try:
            self.root.lift()
            self.root.update_idletasks()
        except tk.TclError:
            pass

    # ------------------------------------------------------------------ geometry

    def move_to(self, x: int, y: int) -> None:
        self.root.geometry(f"{self.size}x{self.size}+{int(x)}+{int(y)}")

    def geometry(self) -> str:
        """What Tk actually assigned, which is not always what we asked for."""
        try:
            self.root.update_idletasks()
            return str(self.root.winfo_geometry())
        except tk.TclError:
            return "unavailable"

    def screen_size(self) -> tuple[int, int]:
        return self.root.winfo_screenwidth(), self.root.winfo_screenheight()

    def pointer(self) -> tuple[int, int]:
        return self.root.winfo_pointerxy()
