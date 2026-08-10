# desktop-pet 🌱

A small creature that lives on your desktop. It wanders along the bottom of the
screen, watches your mouse pointer, naps when you leave it alone, and can be
picked up and thrown around.

No dependencies — just Python and the Tk bindings that ship with it. The
creature is drawn from scratch with circles and splines every frame, so there
are no image files anywhere in this folder.

## Run it

```bash
python pet.py
```

or, equivalently:

```bash
python -m desktop_pet
```

Tk comes with Python on Windows and macOS. On Debian/Ubuntu it is a separate
package:

```bash
sudo apt install python3-tk
```

## Playing with it

| Action | What happens |
| --- | --- |
| Click | A scritch — it perks up and throws hearts |
| Drag | Pick it up; let go mid-air and it falls, bounces and squishes |
| Fling | Throw it — it keeps the speed of your hand and bounces off the screen edges |
| Double-click | Boing |
| Right-click | Menu: scritch, nap, boing, change colour, quit |
| Escape | Quit (click the creature first so it has keyboard focus) |

Leave it alone for about half a minute and it falls asleep, complete with
floating `z`s. Anything you do wakes it up. It also has a mood that rises when
you pet it and drifts down slowly when you don't — a happy creature grins and
moves faster.

## Options

```
--size 128        creature size in pixels
--palette mint    mint | peach | lavender | sky | sunny | slate | random
--fps 50          lower this to 30 to be kinder to a laptop battery
--floor 48        pixels kept clear at the bottom, e.g. for a taskbar
--no-topmost      let other windows cover it
```

For example, a big lavender one that stays above a 60px taskbar:

```bash
python pet.py --size 180 --palette lavender --floor 60
```

At the default settings it uses a few percent of one CPU core.

## Platform notes

The one genuinely platform-specific part is the see-through window:

- **Windows** — fully transparent background via `-transparentcolor`, and the
  transparent area does not intercept clicks.
- **macOS** — transparent via the `-transparent` window attribute.
- **Linux/X11** — Tk cannot request an ARGB visual, so per-pixel transparency
  is not available. The pet falls back to sitting on a small rounded card, so
  the window reads as a deliberate little terrarium rather than a stray
  rectangle. Everything else behaves identically.

Multi-monitor setups are not handled specially: the creature stays on the
primary screen.

## Starting it automatically

- **Windows** — put a shortcut to `pythonw pet.py` in
  `shell:startup` (Win+R → `shell:startup`). `pythonw` keeps the console
  window from appearing.
- **macOS** — System Settings → General → Login Items → add a small
  `.command` file that runs `python3 pet.py`.
- **Linux** — add a `.desktop` file to `~/.config/autostart/`.

## How it works

| File | Job |
| --- | --- |
| `desktop_pet/window.py` | Borderless, always-on-top window; per-platform transparency |
| `desktop_pet/brain.py` | Behaviour and physics — gravity, bouncing, moods, deciding what to do next. Knows nothing about Tk |
| `desktop_pet/creature.py` | Turns a `Pose` into canvas shapes |
| `desktop_pet/app.py` | The loop: read pointer → update brain → move window → redraw |
| `desktop_pet/__main__.py` | Command line |

The split means you can change how the creature behaves without touching how it
looks, and vice versa. Some things worth trying:

- A new colour scheme is one entry in `PALETTES` in `palette.py`.
- New behaviour is a `State` in `brain.py` plus a `_tick_*` method and a weight
  in `_choose_activity`.
- To reshape the creature entirely, `creature.draw` is the only place that
  knows what it looks like.
