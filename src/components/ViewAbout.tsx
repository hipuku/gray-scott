import { Section }      from '@kern/molecules/Section'
import { DataTable }    from '@kern/molecules/DataTable'
import { BulletItem }   from '@kern/atoms/BulletItem'
import { ExternalLink } from '@kern/atoms/ExternalLink'
import { InlineCode }   from '@kern/atoms/InlineCode'

export function ViewAbout() {
  return (
    <div className="flex flex-col gap-12 max-w-3xl mx-auto w-full">

      {/* ── Title ── */}
      <div className="flex flex-col gap-3">
        <h1 className="type-h4 text-void-90">
          Complex organic structure from two coupled equations
        </h1>
        <p className="type-p-sm text-void-60">
          The Gray-Scott model describes two chemical species, a substrate U and an activator V, reacting
          and diffusing across a surface. From those four parameters and a random seed, leopard spots,
          coral branches, labyrinthine stripes, and self-replicating spots all emerge spontaneously. No
          designer is involved. The pattern is a property of the mathematics.
        </p>
      </div>

      {/* ── The equations ── */}
      <Section title="The equations">
        <div className="rounded-xl px-6 py-5 bg-void-20 border border-void-30 flex flex-col gap-2">
          <code className="type-code text-void-70">∂<span className="text-nebula">U</span>/∂t = <span className="text-nebula">D<sub>u</sub></span>∇²<span className="text-nebula">U</span> − UV² + <span className="text-nebula">f</span>(1 − <span className="text-nebula">U</span>)</code>
          <code className="type-code text-void-70">∂<span className="text-supernova">V</span>/∂t = <span className="text-supernova">D<sub>v</sub></span>∇²<span className="text-supernova">V</span> + UV² − (<span className="text-nebula">f</span> + <span className="text-supernova">k</span>)<span className="text-supernova">V</span></code>
        </div>
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          <BulletItem>
            <InlineCode color="text-nebula">D<sub>u</sub></InlineCode> and{' '}
            <InlineCode color="text-supernova">D<sub>v</sub></InlineCode> are the diffusion coefficients, how fast each chemical spreads. U diffuses roughly twice as fast as V.
          </BulletItem>
          <BulletItem>
            <InlineCode color="text-nebula">f</InlineCode> is the feed rate, how quickly U is
            replenished from an external reservoir. Higher f keeps U well-supplied.
          </BulletItem>
          <BulletItem>
            <InlineCode color="text-supernova">k</InlineCode> is the kill rate, how quickly V is
            removed. Together, f and k determine which pattern class emerges.
          </BulletItem>
          <BulletItem>
            The <InlineCode color="text-void-60">UV²</InlineCode> term is the reaction, V is
            autocatalytic (it converts U into more V), but only where both chemicals meet.
          </BulletItem>
        </ul>
      </Section>

      {/* ── Implementation ── */}
      <Section title="Implementation">
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          <BulletItem>
            The simulation runs on a <strong className="text-void-80 font-semibold">512 × 512 grid</strong> — 262,144 pixels updated every frame — using two interleaved{' '}
            <InlineCode color="text-void-60">Float32Array</InlineCode> ping-pong buffers. One buffer
            is read, the other is written, then they swap.
          </BulletItem>
          <BulletItem>
            The Laplacian ∇² is approximated with a <strong className="text-void-80 font-semibold">5-point stencil</strong>: each cell
            reads its four cardinal neighbours. Boundaries wrap around (toroidal topology), so no edge
            artefacts appear.
          </BulletItem>
          <BulletItem>
            Time integration uses forward Euler with <InlineCode color="text-void-60">dt = 1.0</InlineCode>.
            Stability is maintained by the fixed diffusion coefficients: D<sub>u</sub> = 0.2097,
            D<sub>v</sub> = 0.1050 (from Pearson 1993).
          </BulletItem>
          <BulletItem>
            Each frame is rendered in a <strong className="text-void-80 font-semibold">Web Worker</strong> — the
            simulation step and colour mapping run entirely off the main thread. The worker posts back a transferable{' '}
            <InlineCode color="text-void-60">ArrayBuffer</InlineCode>; the main thread wraps it in{' '}
            <InlineCode color="text-void-60">ImageData</InlineCode> and commits to canvas via{' '}
            <InlineCode color="text-void-60">putImageData</InlineCode>, keeping the UI thread free at all speeds.
          </BulletItem>
          <BulletItem>
            Colour mapping uses <strong className="text-void-80 font-semibold">OKLCH interpolation</strong> — a
            perceptually uniform path from void-0 (near-black) to nebula green. A 256-entry lookup table is precomputed at module
            load so the per-pixel render is a single array read, not a float calculation.
          </BulletItem>
        </ul>
      </Section>

      {/* ── The two chemicals ── */}
      <Section title="The two chemicals: U and V">
        <p className="type-p-sm text-void-60">
          What the Simulate view displays is entirely the V concentration — the activator. U, the substrate,
          is its approximate inverse: where V is high (bright), U has been consumed (dark), and vice versa.
        </p>
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          <BulletItem>
            <InlineCode color="text-nebula">U</InlineCode> starts at 1 everywhere (full concentration).
            Where V is present, U is consumed by the autocatalytic reaction UV². High U means the activator
            has not yet reached that region.
          </BulletItem>
          <BulletItem>
            <InlineCode color="text-supernova">V</InlineCode> begins near zero and is produced wherever U is
            present. It diffuses more slowly than U (D<sub>v</sub> ≈ 0.5 × D<sub>u</sub>) — this slower
            spread is what creates the spatial instability. If V diffused as fast as U, the system would
            equilibrate uniformly and no pattern would form.
          </BulletItem>
          <BulletItem>
            The <strong className="text-void-80 font-semibold">Turing instability</strong> (Turing 1952) arises
            precisely because of this asymmetry: a fast-diffusing inhibitor and a slow-diffusing activator
            produce stable spatial patterns from a uniform initial state. The Advanced sliders in Simulate
            let you flip the D<sub>u</sub> / D<sub>v</sub> ratio and watch patterns collapse.
          </BulletItem>
        </ul>
      </Section>

      {/* ── Pearson's classification ── */}
      <Section title="Pattern classification: Pearson (1993)">
        <p className="type-p-sm text-void-60">
          Pearson mapped the (f, k) plane and identified distinct regions where qualitatively different
          patterns emerge. Small changes near a boundary can shift a simulation between classes entirely.
        </p>
        <DataTable
          columns={['Pattern', 'f range', 'k range', 'Character']}
          rows={[
            ['Leopard spots',  '0.025–0.055', '0.058–0.068', 'Circular spots on a continuous background'],
            ['Zebra stripes',  '0.014–0.030', '0.051–0.062', 'Parallel stripe domains, irregular breaks'],
            ['Labyrinth',      '0.030–0.055', '0.053–0.062', 'Continuous, tangled stripe network'],
            ['Mitosis',        '0.022–0.036', '0.057–0.065', 'Self-replicating spots that divide'],
            ['Coral / worms',  '0.046–0.068', '0.058–0.066', 'Branching, irregular worm-like structures'],
          ]}
        />
      </Section>

      {/* ── Academic references ── */}
      <Section title="References">
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          <BulletItem>
            <ExternalLink href="https://doi.org/10.1016/0009-2509(84)80083-8">
              Gray, P. & Scott, S.K. (1984)
            </ExternalLink>
            {' '} the original paper introducing the model for autocatalytic reactions in a
            continuous stirred tank reactor.
          </BulletItem>
          <BulletItem>
            <ExternalLink href="https://doi.org/10.1098/rstb.1952.0012">
              Turing, A.M. (1952). The Chemical Basis of Morphogenesis.
            </ExternalLink>
            {' '} the theoretical foundation. Turing proved that two diffusing chemicals with different
            rates can produce stable spatial patterns from homogeneous initial conditions.
          </BulletItem>
          <BulletItem>
            <ExternalLink href="https://doi.org/10.1126/science.261.5118.189">
              Pearson, J.E. (1993). Complex Patterns in a Simple System.
            </ExternalLink>
            {' '}Science 261(5118), 189–192. The paper that mapped the (f, k) parameter space
            and named the pattern classes used in this tool.
          </BulletItem>
        </ul>
      </Section>


    </div>
  )
}

