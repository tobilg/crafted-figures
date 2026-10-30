'use client';
import {LiveFigure} from '../../../../skill/crafted-figures/kit/react/client.mjs';
import {mount as spring} from '../../../../examples/spring-probe/client.mjs';
import {mount as merging} from '../../../../examples/merging-surfaces/client.mjs';
import {mount as hybrid} from '../../../../examples/ripple-tank/client.mjs';
export default function Live({kind,...props}){return <LiveFigure {...props} mount={{spring,merging,hybrid}[kind]}/>;}
