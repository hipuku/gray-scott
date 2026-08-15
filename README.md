# gray-scott

Reaction-diffusion in the browser. Live at [gray-scott.hipuku.dev](https://gray-scott.hipuku.dev).

A real-time simulation of the Gray-Scott model — two chemicals diffusing and reacting on a grid, producing spots, stripes, labyrinths, and self-replicating mitosis patterns from four numbers.

## Tools

**Simulate** — run the model live on a 512² grid. Adjust the four parameters (feed `f`, kill `k`, diffusion rates `Du`, `Dv`), load named presets, reseed, and pause. The activator field `V` is rendered through a perceptual OKLCH colour ramp.

**Channels** — the substrate `U` and activator `V` fields shown side by side. `U` is drawn as a contrast-matched photo-negative of `V`, and a cursor inspector reads the exact concentration of each field under the pointer — the two channels are one field shown two ways (correlation ≈ −0.995).

**Parameter space** — a map of Pearson's classification of `(f, k)` space. Each labelled region (spots, stripes, labyrinth, mitosis, …) is clickable and loads its representative preset into the simulator.

## Engineering

The core is a from-scratch forward-Euler integrator of the Gray-Scott PDEs with a 5-point Laplacian on a toroidal grid. The simulation runs in a **Web Worker** (rendered frames posted back as transferable `ArrayBuffer`s, so 262k pixels/frame never touch the main thread), and the colour lookup tables are interpolated once in **OKLCH** space at build time so the per-pixel loop is a single array lookup.

See [DESIGN.md](DESIGN.md) for the rationale behind these choices.

## Stack

- React 19 + TypeScript
- Vite, Tailwind CSS v4, [kern](https://github.com/hipuku/kern) (shared component library)
- Web Workers (off-thread simulation)
- Parkinsans + Geist Mono (Google Fonts)

## Development

```bash
npm install
npm run dev
```

## References

- Gray, P. & Scott, S.K. (1984). *Autocatalytic reactions in the isothermal, continuous stirred tank reactor.* Chemical Engineering Science 39(6).
- Pearson, J.E. (1993). *Complex Patterns in a Simple System.* Science 261(5118), 189–192.
- Ottosson, B. (2020). *Oklab colour space.*
