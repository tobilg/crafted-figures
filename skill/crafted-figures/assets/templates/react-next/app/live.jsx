'use client';
import { LiveFigure } from 'crafted-figures/react/client';
import { mount as probe } from '../figures/spring-probe/client.mjs';
import { mount as drops } from '../figures/merging-surfaces/client.mjs';
export default function Live({ kind, ...props }) {
  return <LiveFigure {...props} mount={kind === 'probe' ? probe : drops} />;
}
