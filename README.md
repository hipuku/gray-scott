# gray-scott

Gray-Scott reaction-diffusion, simulated in real time in the browser. Live at [gray-scott.hipuku.dev](https://gray-scott.hipuku.dev).

## Tools

- **Simulate** the model live on a 512 x 512 grid, with presets and all four parameters.
- **Channels** shows both chemical fields side by side, with a readout under the pointer.
- **Parameter space** maps Pearson's pattern regions. Hover to read (f, k) and the pattern at any point.

The simulation runs in a Web Worker, and colour is interpolated in OKLCH.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Web Workers, [kern](https://github.com/hipuku/kern).

## Development

```bash
npm install
npm run dev
```

`npm test`, `npm run lint` and `npm run typecheck` run the checks CI runs.

## References

- Gray, P. and Scott, S.K. (1984). Autocatalytic reactions in the isothermal, continuous stirred tank reactor. *Chemical Engineering Science* 39(6).
- Pearson, J.E. (1993). Complex patterns in a simple system. *Science* 261(5118), 189 to 192.

## Licence

MIT
