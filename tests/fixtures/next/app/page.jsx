import { Suspense } from 'react';
import Link from 'next/link';
import { prepareFigure } from '../../../../skill/crafted-figures/kit/react/server.mjs';
import dial from '../../../../examples/dial-indicator/figure.mjs';
import spring from '../../../../examples/spring-probe/figure.mjs';
import merging from '../../../../examples/merging-surfaces/figure.mjs';
import hybrid from '../../../../examples/ripple-tank/figure.mjs';
import Live from './live.jsx';
export const dynamic = 'force-dynamic';
async function Figures() {
  const specs = [
    ['spring-a', 'spring', spring, 'light'],
    ['spring-b', 'spring', spring, 'dark'],
    ['merging-a', 'merging', merging, 'light'],
    ['hybrid-a', 'hybrid', hybrid, 'dark'],
  ];
  return Promise.all(
    specs.map(async ([id, kind, figure, theme]) => (
      <Live
        key={id}
        kind={kind}
        {...(await prepareFigure({
          id,
          figure,
          pose: 'mid',
          config: { schemaVersion: 2, theme, motion: { enabled: false } },
        }))}
      />
    )),
  );
}
async function StaticDial() {
  const frame = await prepareFigure({
    id: 'dial-static',
    figure: dial,
    pose: 'mid',
    config: { schemaVersion: 1 },
  });
  return (
    <article
      className="crafted"
      data-instance={frame.id}
      data-static-figure={frame.figureId}
      data-frame={frame.config.frame}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered figure from trusted authoring code
      dangerouslySetInnerHTML={{ __html: frame.html }}
    />
  );
}
export default function Page() {
  return (
    <main style={{ maxWidth: 1100, margin: 'auto', padding: 24 }}>
      <h1>Independent figure instances</h1>
      <Link href="/away">Navigate away</Link>
      <Suspense fallback={<p>Preparing vector drawings…</p>}>
        <Figures />
        <StaticDial />
      </Suspense>
      {Array.from({ length: 30 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of filler paragraphs
        <p key={i}>
          Integration text block {i + 1}. Each figure owns its controls, styles, state and cleanup.
        </p>
      ))}
    </main>
  );
}
