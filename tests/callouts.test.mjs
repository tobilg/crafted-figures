import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import { frameContent } from '../skill/crafted-figures/kit/frame-content.mjs';
import * as kit from '../skill/crafted-figures/kit/index.mjs';

const k = kit.illustration,
  still = { pose() {} };

async function scene() {
  const { config, tokens } = await resolveConfig({
      layers: [{ label: 't', value: { preset: 'illustrated' } }],
    }),
    stage = k.createStage({
      config,
      tokens,
      bounds: k.boxBounds([-60, -60, 0], [60, 60, 60]),
      padding: { top: 20, right: 20, bottom: 40, left: 20 },
    }),
    base = k.box('base', { width: 120, depth: 120, height: 6 }),
    block = k.box('block', { width: 30, depth: 30, height: 30 }),
    cap = k.box('cap', { width: 20, depth: 20, height: 6 });
  base.position.z = 3;
  block.position.z = 21;
  cap.position.set(0, 0, 45);
  stage.scene.add(base, block, cap);
  stage.scene.updateMatrixWorld(true);
  return { stage, base, block, cap };
}
const item = (id, part, extra = {}) => ({
  id,
  label: id,
  description: `About ${id}.`,
  part,
  ...extra,
});

test('badges are numbered in order, with a leader to the anchor, and a matching legend', async () => {
  const { stage, block, cap } = await scene(),
    notes = k.callouts(stage, [item('block', block), item('cap', cap)], still);
  stage.scene.updateMatrixWorld(true);
  const drawing = stage.render();
  assert.match(drawing, /<g data-callouts aria-hidden="true">/);
  assert.equal(drawing.match(/class="callout-leader"/g).length, 2);
  assert.match(drawing, /data-callout="block"[\s\S]*?<text y="3.9">1<\/text>/);
  assert.match(drawing, /data-callout="cap"[\s\S]*?<text y="3.9">2<\/text>/);
  assert.ok(drawing.lastIndexOf('data-callouts') > drawing.lastIndexOf('data-object='), 'on top');
  assert.deepEqual(
    notes.legend().map(row => [row.number, row.label, row.callout, row.active]),
    [
      [1, 'block', 'block', false],
      [2, 'cap', 'cap', false],
    ],
  );
  stage.dispose();
});

test('placement is repeatable, inside the drawing, clear of the reading and of other badges', async () => {
  const draw = async () => {
    const { stage, base, block, cap } = await scene();
    k.callouts(
      stage,
      [
        item('base', base, { at: [50, -50, 3] }),
        item('block', block),
        item('cap', cap),
        item('corner', base, { at: [-50, 50, 3] }),
      ],
      still,
    );
    const drawing = stage.render();
    stage.dispose();
    return drawing;
  };
  const first = await draw();
  assert.equal(await draw(), first);
  const badges = [
    ...first.matchAll(/class="callout-badge" transform="translate\(([\d.-]+) ([\d.-]+)\)"/g),
  ].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(badges.length, 4);
  const narrow = (11 * 600) / 340;
  for (const [x, y] of badges) {
    assert.ok(x >= narrow && x <= 600 - narrow, `x ${x}`);
    assert.ok(y >= narrow && y <= 400 - 40 - narrow, `y ${y}`);
  }
  for (const [i, a] of badges.entries())
    for (const b of badges.slice(i + 1))
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= narrow * 2, 'clear at phone size');
});

test('a badge stays put while its leader follows the part, unless asked to follow', async () => {
  const { stage, cap, block } = await scene();
  k.callouts(
    stage,
    [item('still', cap), item('moving', block, { follow: true, offset: [120, -40] })],
    still,
  );
  const read = (drawing, id) => {
    const node = drawing.match(new RegExp(`data-callout="${id}"[\\s\\S]*?</g></g></g>`))[0];
    return {
      leader: node.match(/d="([^"]+)"/)[1],
      badge: node.match(/callout-badge" transform="([^"]+)"/)[1],
    };
  };
  const before = stage.render();
  cap.position.z = 50;
  block.position.x = 5;
  stage.scene.updateMatrixWorld(true);
  const after = stage.render();
  assert.notEqual(read(after, 'still').leader, read(before, 'still').leader);
  assert.equal(read(after, 'still').badge, read(before, 'still').badge);
  assert.notEqual(read(after, 'moving').badge, read(before, 'moving').badge);
  stage.dispose();
});

test('active and visible follow the model, and a hidden part hides its callout', async () => {
  const { stage, block, cap } = await scene(),
    notes = k.callouts(
      stage,
      [
        item('block', block, { active: m => m.on }),
        item('cap', cap, { visible: m => m.on }),
        { id: 'point', label: 'Point', description: 'A point in space.', at: m => [m.x, 0, 30] },
      ],
      { pose: () => stage.callouts.update({ on: false, x: 0 }) },
    );
  notes.update({ on: false, x: 0 });
  const off = stage.render();
  assert.match(off, /data-callout="block">/);
  assert.match(off, /data-callout="cap" display="none"/);
  notes.update({ on: true, x: 10 });
  const on = stage.render();
  assert.match(on, /data-callout="block" data-active=""/);
  assert.match(on, /data-callout="cap">/);
  assert.equal(notes.legend()[0].active, true);
  assert.notEqual(
    on.match(/data-callout="point"[\s\S]*?d="([^"]+)"/)[1],
    off.match(/data-callout="point"[\s\S]*?d="([^"]+)"/)[1],
  );
  block.visible = false;
  stage.scene.updateMatrixWorld(true);
  assert.match(stage.render(), /data-callout="block" data-active="" display="none"/);
  stage.dispose();
});

test('a drawn legend row links to its callout and shows its number', () => {
  const { footer } = frameContent({
    legend: [
      { label: 'Pan', description: 'Carries <the> load.', callout: 'pan', number: 1, active: true },
      { label: 'Plain', description: 'No callout.' },
    ],
  });
  assert.match(
    footer,
    /<dt data-callout="pan" data-active=""><span class="callout-key">1<\/span>Pan<\/dt>/,
  );
  assert.match(footer, /Carries &lt;the&gt; load\./);
  assert.match(footer, /<dt>Plain<\/dt><dd>No callout\.<\/dd>/);
  assert.throws(
    () => frameContent({ legend: [{ label: 'a', description: 'b', other: 1 }] }),
    /legend/,
  );
});

test('inspect fails what a reader would see as wrong', async () => {
  const { stage, block, cap } = await scene(),
    notes = k.callouts(
      stage,
      [
        item('a', cap, { badge: [300, 40] }),
        item('b', block, { badge: [312, 40] }),
        item('off', cap, { badge: [598, 40] }),
      ],
      still,
    );
  stage.render();
  const codes = (found, id) => found.filter(f => f.id === id).map(f => f.code);
  // At 900 px wide the badges are about 7 units in radius, and on a phone about 19.
  assert.deepEqual(codes(notes.inspect(900), 'a'), ['CALLOUT_OVERLAP']);
  assert.deepEqual(codes(notes.inspect(340), 'off'), ['CALLOUT_OUTSIDE']);
  stage.dispose();

  const hidden = await scene(),
    behind = hidden.stage.callouts,
    notes2 = k.callouts(
      hidden.stage,
      [
        item('inside', hidden.block, { at: [0, 0, 0] }),
        { id: 'buried', label: 'Buried', description: 'Inside the block.', at: [0, 0, 21] },
        {
          id: 'allowed',
          label: 'Allowed',
          description: 'May pass behind.',
          at: [0, 0, 21],
          mayHide: true,
        },
      ],
      still,
    );
  assert.equal(behind, undefined);
  hidden.stage.render();
  const found = notes2
    .inspect(900)
    .filter(f => f.code === 'CALLOUT_HIDDEN')
    .map(f => f.id);
  assert.deepEqual(found, ['buried'], 'its own part may cover an anchor; another part may not');
  hidden.stage.dispose();
});

test('bad input and a drawing with no room fail with a useful message', async () => {
  const { stage, block } = await scene();
  assert.throws(() => k.callouts(stage, [], still), /at least one/);
  assert.throws(() => k.callouts(stage, [item('1bad', block)], still), /invalid id/);
  assert.throws(() => k.callouts(stage, [item('a', block), item('a', block)], still), /duplicate/);
  assert.throws(
    () => k.callouts(stage, [{ id: 'a', label: 'a', description: 'b' }], still),
    /part or an at/,
  );
  assert.throws(() => k.callouts(stage, [{ id: 'a', part: block }], still), /label/);
  assert.throws(
    () => k.callouts(stage, [item('a', block, { badge: [1, 1], offset: [1, 1] })], still),
    /choose one/,
  );
  assert.throws(
    () =>
      k.callouts(
        stage,
        Array.from({ length: 60 }, (_, i) => item(`n${i}`, block)),
        still,
      ),
    /CALLOUT_NO_ROOM/,
  );
  assert.throws(() => k.callouts(stage, [item('a', block)]), /pose/);
  stage.dispose();
});

test('badges land in the same place whichever state is drawn first', async () => {
  const draw = async first => {
    const { stage, cap } = await scene(),
      update = ({ lift }) => {
        cap.position.z = 45 + lift;
        stage.scene.updateMatrixWorld(true);
      };
    k.callouts(stage, [item('cap', cap)], { pose: () => update({ lift: 0 }) });
    update({ lift: first });
    stage.render();
    update({ lift: 6 });
    const drawing = stage.render();
    stage.dispose();
    return drawing;
  };
  assert.equal(await draw(0), await draw(9));
});

test('reading the model without giving it one says what to do', async () => {
  const { stage, block } = await scene();
  assert.throws(
    () => k.callouts(stage, [{ ...item('a', block), at: m => [m.x, 0, 0] }], still),
    /must call stage\.callouts\?\.update\(model\)/,
  );
  stage.dispose();
});

test('a part named by a string is looked up fresh, so a replaced part keeps its callout', async () => {
  const { stage, block } = await scene(),
    notes = k.callouts(stage, [item('block', 'block')], still);
  const leaderOf = () => stage.render().match(/class="callout-leader" d="([^"]+)"/)[1],
    before = leaderOf(),
    swapped = k.box('block', { width: 30, depth: 30, height: 30 });
  swapped.position.set(25, 0, 21);
  stage.scene.remove(block);
  stage.scene.add(swapped);
  stage.scene.updateMatrixWorld(true);
  assert.notEqual(leaderOf(), before);
  assert.deepEqual(
    notes.inspect(900).filter(f => f.code === 'CALLOUT_HIDDEN'),
    [],
  );
  stage.dispose();
  const empty = await scene();
  assert.throws(() => k.callouts(empty.stage, [item('x', 'nothing')], still), /names no part/);
  empty.stage.dispose();
});
