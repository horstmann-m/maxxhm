# desktop-pet 🐉

A small creature that lives on your desktop. It stomps along the bottom of the
screen, tracks your mouse pointer with a slit-pupil eye, curls up and breathes
smoke rings when you leave it alone, and can be picked up and thrown around.

No dependencies — just Python and the Tk bindings that ship with it. Both
creatures are drawn from scratch with splines and circles every frame, so there
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

## The creatures

**`dragon`** (default) — a baby dragon. Horns, claws, a spined tail and
scalloped wings that beat when it jumps. It breathes fire when you pet it,
shows a fang when it is pleased with itself, and curls up with its tail wrapped
around itself to sleep.

**`blob`** — the original: a round, sprouted, thoroughly cheerful thing. Throws
hearts instead of fire.

```bash
python pet.py --creature blob
```

You can also switch between them at runtime from the right-click menu.

## Playing with it

| Action | What happens |
| --- | --- |
| Click | A scritch — it perks up and breathes a puff of fire |
| Drag | Pick it up; let go mid-air and it falls, bounces and squishes |
| Fling | Throw it — it keeps the speed of your hand and bounces off the screen edges |
| Double-click | Boing — wings beat while it is off the ground |
| Right-click | Menu: scritch, nap, boing, change colour, switch creature, quit |
| Escape | Quit (click the creature first so it has keyboard focus) |

Leave it alone for about half a minute and it falls asleep, breathing slow
smoke rings. Anything you do wakes it up. It also has a mood that rises when
you pet it and drifts down slowly when you don't — a happy creature grins and
moves faster.

## Options

```
--creature dragon  dragon | blob
--size 128         creature size in pixels
--palette random   see below; 'random' picks one suited to the creature
--fps 50           lower this to 30 to be kinder to a laptop battery
--floor 48         pixels kept clear at the bottom, e.g. for a taskbar
--no-topmost       let other windows cover it
```

Colours for the dragon are `ember` (charcoal and orange), `storm` (deep blue,
cyan fire), `jade`, `dusk` (violet) and `bone`. The blob keeps `mint`, `peach`,
`lavender`, `sky`, `sunny` and `slate`. Any palette can be forced onto either
creature by name; `random` stays within the family that suits it.

For example, a big storm dragon that stays above a 60px taskbar:

```bash
python pet.py --size 180 --palette storm --floor 60
```

The dragon costs roughly 10% of one CPU core at 50 fps, measured against a
software X server — a worst case, since it has no graphics acceleration to
lean on. Dropping to `--fps 30` takes that to about 7%, and the blob is around
half the dragon either way (it draws about half as many shapes per frame).

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

- **Windows** — put a shortcut to `pythonw pet.py` in `shell:startup`
  (Win+R → `shell:startup`). `pythonw` keeps the console window from appearing.
- **macOS** — System Settings → General → Login Items → add a small
  `.command` file that runs `python3 pet.py`.
- **Linux** — add a `.desktop` file to `~/.config/autostart/`.

## How it works

| File | Job |
| --- | --- |
| `desktop_pet/window.py` | Borderless, always-on-top window; per-platform transparency |
| `desktop_pet/brain.py` | Behaviour and physics — gravity, bouncing, moods, deciding what to do next. Knows nothing about Tk |
| `desktop_pet/pose.py` | The `Pose` and `Particle` vocabulary the brain and the renderers share |
| `desktop_pet/creatures/` | One module per creature, each turning a `Pose` into canvas shapes |
| `desktop_pet/palette.py` | Colour schemes, plus the mixing used for glows and shading |
| `desktop_pet/app.py` | The loop: read pointer → update brain → move window → redraw |

The split means you can change how a creature behaves without touching how it
looks, and vice versa. Some things worth trying:

- A new colour scheme is one entry in `PALETTES` in `palette.py`.
- New behaviour is a `State` in `brain.py` plus a `_tick_*` method and a weight
  in `_choose_activity` — both creatures inherit it for free.
- A whole new creature is a module in `creatures/` exposing `draw(canvas,
  width, height, pose, palette, backdrop)`, plus a line in `KINDS`.

Two things the dragon's geometry is worth knowing about, if you go editing it:
shapes are written once facing right and mirrored through a helper, and
Tk's `smooth=True` rounds off corners — the spikes get their points from
deliberately doubled vertices.
