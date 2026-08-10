"""A small creature that lives on your desktop.

Pure standard library: Tk for the window, everything else drawn by hand.
"""

__version__ = "1.0.0"

__all__ = ["PetApp"]


def __getattr__(name: str):
    # Imported lazily so ``import desktop_pet`` does not require a display.
    if name == "PetApp":
        from .app import PetApp

        return PetApp
    raise AttributeError(name)
