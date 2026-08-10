"""Wires the window, the brain and the renderer together."""

from __future__ import annotations

import platform
import random
import time
import tkinter as tk

from . import __version__, creatures, palette as palettes
from .brain import Brain, State, World
from .pose import Particle, Pose
from .window import PetWindow

CLICK_SLOP = 5  # pixels of movement still counted as a click, not a drag


class PetApp:
    def __init__(
        self,
        size: int = 128,
        creature: creatures.Kind | str | None = None,
        palette: palettes.Palette | str | None = None,
        fps: int = 50,
        floor_margin: int = 48,
        topmost: bool = True,
        plain: bool = False,
        allow_transparency: bool = True,
    ):
        self.window = PetWindow(
            size, topmost=topmost, plain=plain, allow_transparency=allow_transparency
        )
        self.kind = creature if isinstance(creature, creatures.Kind) else creatures.get(creature)
        self.palette = (
            palette
            if isinstance(palette, palettes.Palette)
            else palettes.get(palette, prefer=self.kind.name)
        )
        self.size = size
        self.frame_ms = max(8, int(1000 / max(1, fps)))

        screen_w, screen_h = self.window.screen_size()
        self.world = World(
            left=0,
            right=max(0, screen_w - size),
            floor=max(0, screen_h - floor_margin - size),
        )
        start_x = random.randint(int(screen_w * 0.25), int(screen_w * 0.75))
        self.brain = Brain(start_x, self.world.floor, self.world, size)

        self.particles: list[Particle] = []
        self._press: tuple[int, int] | None = None
        self._grab_offset = (0, 0)
        self._drag_trail: list[tuple[float, int, int]] = []
        self._dragging = False
        self._breath_cooldown = 0.0
        self._wing = 0.0
        self._last_tick = time.perf_counter()
        self._lift_cooldown = 0.0
        self._running = True
        self._after_id: str | None = None

        self._bind_events()
        self.window.move_to(self.brain.x, self.brain.y)

    # ------------------------------------------------------------------- events

    def _bind_events(self) -> None:
        canvas = self.window.canvas
        canvas.bind("<ButtonPress-1>", self._on_press)
        canvas.bind("<B1-Motion>", self._on_drag)
        canvas.bind("<ButtonRelease-1>", self._on_release)
        canvas.bind("<Double-Button-1>", self._on_double_click)
        canvas.bind("<Button-3>", self._on_menu)
        canvas.bind("<Button-2>", self._on_menu)  # macOS trackpads
        canvas.bind("<Escape>", lambda _event: self.quit())
        self.window.root.bind("<Escape>", lambda _event: self.quit())
        self.window.root.protocol("WM_DELETE_WINDOW", self.quit)

    def _on_press(self, event) -> None:
        # Take keyboard focus so Escape works without a taskbar entry.
        self.window.canvas.focus_set()
        self._press = (event.x_root, event.y_root)
        self._grab_offset = (event.x_root - int(self.brain.x), event.y_root - int(self.brain.y))
        self._drag_trail = [(time.perf_counter(), event.x_root, event.y_root)]
        self._dragging = False
        self.brain.wake()

    def _on_drag(self, event) -> None:
        if self._press is None:
            return
        moved = abs(event.x_root - self._press[0]) + abs(event.y_root - self._press[1])
        if not self._dragging and moved < CLICK_SLOP:
            return
        if not self._dragging:
            self._dragging = True
            self.brain.begin_drag()

        self.brain.drag_to(event.x_root - self._grab_offset[0], event.y_root - self._grab_offset[1])
        self._drag_trail.append((time.perf_counter(), event.x_root, event.y_root))
        del self._drag_trail[:-6]  # only the tail matters for throw velocity

    def _on_release(self, event) -> None:
        if self._press is None:
            return
        if self._dragging:
            self.brain.release(*self._throw_velocity())
        else:
            self.brain.pet()
            self._spawn_delight()
        self._press = None
        self._dragging = False

    def _throw_velocity(self) -> tuple[float, float]:
        if len(self._drag_trail) < 2:
            return 0.0, 0.0
        t0, x0, y0 = self._drag_trail[0]
        t1, x1, y1 = self._drag_trail[-1]
        dt = t1 - t0
        if dt <= 1e-3:
            return 0.0, 0.0
        cap = 1600.0
        vx = max(-cap, min(cap, (x1 - x0) / dt))
        vy = max(-cap, min(cap, (y1 - y0) / dt))
        return vx, vy

    def _on_double_click(self, _event) -> None:
        self.brain.hop(700.0)

    def _on_menu(self, event) -> None:
        menu = tk.Menu(self.window.root, tearoff=0)
        menu.add_command(label="Give a scritch", command=self._scritch)
        if self.brain.state is State.SLEEP:
            menu.add_command(label="Wake up", command=self.brain.wake)
        else:
            menu.add_command(label="Take a nap", command=self.brain.doze_off)
        menu.add_command(label="Boing!", command=lambda: self.brain.hop(720.0))
        menu.add_command(label="Change colour", command=self._cycle_palette)
        menu.add_command(label="Switch creature", command=self._cycle_creature)
        menu.add_separator()
        menu.add_command(label="Quit", command=self.quit)
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def _scritch(self) -> None:
        self.brain.pet()
        self._spawn_delight()

    def _cycle_palette(self) -> None:
        self.palette = palettes.next_after(self.palette)

    def _cycle_creature(self) -> None:
        order = list(creatures.NAMES)
        self.kind = creatures.KINDS[order[(order.index(self.kind.name) + 1) % len(order)]]
        # Carry the colour across only if it suits the new creature.
        if self.palette.family != self.kind.name:
            self.palette = palettes.get("random", prefer=self.kind.name)
        self.particles.clear()

    # ---------------------------------------------------------------- particles

    def _spawn_delight(self) -> None:
        """What the creature emits when petted: fire, or hearts."""
        kind = self.kind.pet_particle
        facing = self.brain.facing
        for _ in range(4 if kind == "flame" else 3):
            if kind == "flame":
                # Breathed forward from the snout, arcing up as it cools.
                # The offsets track where the dragon's mouth actually is.
                self.particles.append(
                    Particle(
                        kind=kind,
                        x=0.5 + facing * random.uniform(0.28, 0.34),
                        y=random.uniform(0.50, 0.56),
                        vx=facing * random.uniform(0.35, 0.60),
                        vy=random.uniform(-0.30, -0.12),
                        decay=random.uniform(1.3, 1.9),
                        size=random.uniform(0.7, 1.3),
                    )
                )
            else:
                self.particles.append(
                    Particle(
                        kind=kind,
                        x=random.choice((random.uniform(0.14, 0.36), random.uniform(0.64, 0.86))),
                        y=random.uniform(0.16, 0.26),
                        vy=-0.32,
                        decay=0.85,
                        size=random.uniform(0.75, 1.25),
                    )
                )

    def _update_particles(self, dt: float) -> None:
        for particle in self.particles:
            particle.life -= dt * particle.decay
            particle.x += particle.vx * dt
            particle.y += particle.vy * dt
            particle.vx *= 0.94  # air resistance, so flames stall and rise
            particle.vy -= dt * 0.20
        self.particles = [p for p in self.particles if p.life > 0 and p.y > -0.15]

        self._breath_cooldown -= dt
        if self.brain.state is State.SLEEP and self._breath_cooldown <= 0:
            self._breath_cooldown = self.kind.sleep_rate
            facing = self.brain.facing
            smoke = self.kind.sleep_particle == "smoke"
            self.particles.append(
                Particle(
                    kind=self.kind.sleep_particle,
                    # Smoke rings leave the curled-up dragon's nostrils; the
                    # blob's "z"s just float above its head.
                    x=0.5 + facing * (0.30 if smoke else 0.22),
                    y=0.63 if smoke else 0.34,
                    vx=facing * 0.05,
                    vy=-0.09 if smoke else -0.06,
                    decay=0.45,
                    size=random.uniform(0.8, 1.2),
                )
            )

    # --------------------------------------------------------------------- loop

    def _tick(self) -> None:
        if not self._running:
            return
        try:
            self._step()
        except KeyboardInterrupt:  # Ctrl-C in the launching terminal
            self.quit()
            return
        self._after_id = self.window.root.after(self.frame_ms, self._tick)

    def _step(self) -> None:
        now = time.perf_counter()
        # Clamp dt so a stalled or suspended machine does not teleport the pet.
        dt = min(0.05, max(0.0, now - self._last_tick))
        self._last_tick = now

        pointer = self.window.pointer()
        if pointer[0] < 0:  # pointer left the screen
            pointer = (int(self.brain.centre[0]), int(self.brain.centre[1]))

        self.brain.update(dt, pointer)
        # Wings beat hard in the air and idle-flutter on the ground.
        self._wing += dt * (16.0 if not self.brain.grounded else 2.0)
        self._update_particles(dt)
        self.window.move_to(self.brain.x, self.brain.y)
        self._render()
        self._keep_on_top(dt)

    def _keep_on_top(self, dt: float) -> None:
        # Some window managers drop the topmost hint when other windows claim
        # focus; a periodic lift is cheap insurance.
        self._lift_cooldown -= dt
        if self._lift_cooldown <= 0:
            self._lift_cooldown = 2.0
            try:
                self.window.root.lift()
            except tk.TclError:
                pass

    def _render(self) -> None:
        pose = Pose(
            facing=self.brain.facing,
            squash=self.brain.squash,
            blink=self.brain.blink,
            look=self.brain.look,
            smile=self.brain.smile,
            step=self.brain.step,
            wobble=self.brain.wobble,
            wing=self._wing,
            lift=self.brain.tuck,
            asleep=self.brain.state is State.SLEEP,
            particles=self.particles,
        )
        self.kind.draw(
            self.window.canvas,
            self.size,
            self.size,
            pose,
            self.palette,
            backdrop=not self.window.transparent,
        )

    def quit(self) -> None:
        self._running = False
        # Cancel the queued frame first: destroying the root with a callback
        # still pending makes Tk complain about an invalid command name.
        if self._after_id is not None:
            try:
                self.window.root.after_cancel(self._after_id)
            except tk.TclError:
                pass
            self._after_id = None
        try:
            self.window.root.destroy()
        except tk.TclError:
            pass

    def describe(self) -> str:
        """One line saying where the pet is and how it is being drawn.

        Printed at startup: when someone cannot find their pet, this is the
        difference between guessing and knowing.
        """
        screen_w, screen_h = self.window.screen_size()
        window = "plain" if self.window.plain else "borderless"
        skin = "transparent" if self.window.transparent else "opaque card"
        return (
            f"desktop-pet {__version__}: {self.kind.name} in {self.palette.name} | "
            f"Tk {self.window.tk_patchlevel} on {platform.system()} | "
            f"screen {screen_w}x{screen_h} | {window} window, {skin} | "
            f"asked for {self.size}px at ({int(self.brain.x)}, {int(self.brain.y)}), "
            f"Tk reports {self.window.geometry()}"
        )

    def run(self) -> None:
        print(self.describe(), flush=True)
        if self.window.legacy_aqua_tk:
            print(
                "note: this is Apple's system Tk 8.5, which cannot do a "
                "see-through window -- the pet sits on a small card instead. "
                "Install Python from python.org (or `brew install python-tk`) "
                "for Tk 8.6 and a transparent background.",
                flush=True,
            )
        self._last_tick = time.perf_counter()
        self._after_id = self.window.root.after(self.frame_ms, self._tick)
        try:
            self.window.root.mainloop()
        except KeyboardInterrupt:
            self.quit()
