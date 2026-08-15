# gray-scott — design notes

Engineering notes for this experiment: what it does, and why the non-obvious decisions were made the way they were. Not a spec — the kind of design doc you'd write up for someone picking this up cold. If a piece of the code looks stranger than it needs to be, the reason is probably here.

---

## What it is

A real-time Gray-Scott reaction-diffusion simulation that runs entirely in the browser. Two chemicals — a substrate `U` and an activator `V` — diffuse across a grid and react, and from four scalar parameters (`f`, `k`, `Du`, `Dv`) the system produces the whole Pearson zoo: spots, stripes, labyrinths, self-replicating mitosis. No backend, no GPU shaders — the maths is plain TypeScript, kept fast enough for 60fps by where it runs, not by how clever the arithmetic is.

Three tools: **Simulate** (drive one field live), **Channels** (see `U` and `V` together with a cursor inspector), **Parameter space** (Pearson's `(f,k)` map, click to load a preset).

---

## The model, and why forward-Euler is fine here

```
∂U/∂t = Du·∇²U − UV² + f(1 − U)
∂V/∂t = Dv·∇²V + UV² − (f + k)V
```

Discretised with a 5-point Laplacian stencil on a toroidal (wrap-around) grid and integrated with forward-Euler. Forward-Euler is the least sophisticated integrator available, and for a stiff PDE that would normally be the wrong call — but the Gray-Scott parameter regime of interest uses small diffusion rates and a unit timestep that sits comfortably inside the stability bound. A higher-order integrator (RK4, implicit) would cost 2–4× the compute per step to buy accuracy the visual output doesn't need: we're rendering emergent pattern classes, not measuring concentrations. The simple integrator is the right tool because the goal is qualitative.

The grid is toroidal because a bounded grid puts a visible seam in the patterns — edges behave differently from the interior. Wrap-around makes the field homogeneous, so a stripe pattern tiles seamlessly and there's no artificial boundary to reason about.

---

## Why the simulation lives in a Web Worker

The grid is 512² = 262,144 cells. Each step touches every cell twice (compute + render), and we want tens of steps per animation frame. Running that on the main thread would block paint and make the whole UI — sidebar, controls, cursor — janky or frozen.

So the sim owns its state inside a **worker**. The worker runs `step()` + render and posts finished frames back as **transferable `ArrayBuffer`s** (zero-copy — ownership moves to the main thread instead of the bytes being cloned). The main thread's only job is `putImageData`. This is the single decision that makes the thing feel real-time rather than a slideshow.

There are two workers, deliberately:

- `simulation.worker.ts` renders `V` to pixels **inside** the worker and ships finished RGBA — the Simulate view never needs the raw field, so we do the colour mapping off-thread too.
- `isolate.worker.ts` ships back the raw `U` and `V` **Float32** fields and lets the main thread render them. The Channels view needs the actual concentration under the cursor for its inspector, so the raw numbers have to reach the main thread anyway. Rendering there is the price of the inspector, and it's paid only in the view that needs it.

Splitting them keeps each worker's message protocol honest about what that view actually consumes, rather than one general-purpose worker that always ships the maximum.

---

## Colour: OKLCH lookup tables, built once

Concentration → colour is the hot path — it runs once per pixel per frame. Doing perceptual-space interpolation there (sRGB → Oklab → back, per pixel) would be dozens of transcendental ops × 262k × 60/s. Untenable.

Instead each ramp is precomputed into a 256-entry **LUT** at build time: interpolate `from`→`to` in **OKLCH** (perceptually uniform, so the ramp's lightness climbs evenly instead of bunching up the way an sRGB lerp does), bake the result to RGB bytes, and the per-pixel loop becomes a single indexed array read. All the colour maths (Ottosson's Oklab formulas) happens 256 times total, not 15 million times a second.

### The achromatic-hue trap

Both ramps go from near-black `void` to a saturated accent. A near-black colour has effectively zero chroma, which means its *hue is undefined* — `atan2` on a near-zero `(a, b)` pair returns an arbitrary angle (our `void` read as roughly blue). Interpolating hue from that arbitrary angle to the accent's hue dragged the ramp through off-palette midtones — the green ramp visibly passed through navy in the middle.

Fix: detect an achromatic endpoint (`chroma < ε`) and **anchor its hue to the chromatic end**, so the ramp is a clean constant-hue sweep from dark to accent. Hue also interpolates the short way around the circle. This is the kind of bug that only shows up because OKLCH is polar — an sRGB lerp would never have exposed it, but an sRGB lerp is also what produced the muddy midtones in the first place.

### Rendering U as a photo-negative

`U` sits near its feed baseline of ~1 almost everywhere and only dips to ~0.4 where the reaction consumes it. Drawn literally, it's a flat mid-tone with invisible structure. So `renderU` stretches the band `[0.5, 1]` across the full ramp: depleted regions fall to black, replenished regions stay bright. The result reads as a true photo-negative of `V`, contrast-matched to `V`'s ×3 amplification — which is honest, because `U` and `V` genuinely are anti-correlated (≈ −0.995). The stretch isn't decoration; it makes a real relationship legible that the raw range hides.

---

## Controls convention

Two layouts, one rule: **single-canvas views put controls in a right sidebar; multi-canvas comparison views put them in a top bar.** Simulate (one field) uses the sidebar; Channels (two fields side by side) uses the top bar so the controls don't steal width from either canvas. It's a small thing but applying it consistently is what makes the two views feel like one tool rather than two.

---

## Palette

Three accents, mapped to the model's own structure so the colour isn't arbitrary:

- **nebula** green — the substrate family (`U`, `Du`, `f`), plus `--primary`/`--ring`/nav.
- **supernova** yellow — the activator family (`V`, `Dv`, `k`), plus links.
- **solstice** orange — the third accent (logo warm stop, colophon).

Page chrome stays inside these three plus `void` neutrals. The one sanctioned exception is the **Parameter-space region map**, which is genuinely categorical — each Pearson region needs a distinguishable hue — so it's allowed five colours (adding tidal/quasar). Categorical data earns categorical colour; nothing else does.

Pattern glyphs (spots/stripes/labyrinth/mitosis/branch) are custom tiny SVGs in `components/PatternGlyph.tsx`, keyed by both preset id and Pearson region id since they map to the same five shapes. All other iconography is lucide-react — a second icon dependency was rejected to keep the experiment cohesive with its siblings.

---

## Accepted tradeoffs

**Fixed 512² grid.** Grid size is a compile-time constant, not a user control. Larger grids blow the per-frame budget; smaller ones lose pattern detail. 512 is the sweet spot for this hardware target, and exposing it as a knob would invite the user to pick a value that makes the sim stutter.

**CPU, not GPU.** A WebGL/WebGPU fragment-shader implementation would be dramatically faster and could run far bigger grids. It would also make the simulation a black box — the point of this experiment is that the reaction-diffusion maths is *visible, readable TypeScript* you can step through, not a shader string. The worker architecture buys enough headroom that the CPU version is smooth, so the legibility is free.

**Qualitative, not quantitative.** No error bounds, no conservation checks, no measurement readouts beyond the cursor inspector. This is a tool for *seeing* pattern formation, not for numerically studying it — every accuracy-vs-clarity call is resolved toward clarity.
