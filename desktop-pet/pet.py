#!/usr/bin/env python3
"""Double-clickable launcher: ``python pet.py`` from this folder.

Same thing as ``python -m desktop_pet``, minus having to remember that.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from desktop_pet.__main__ import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
