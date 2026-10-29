import test from 'node:test';
import assert from 'node:assert/strict';

import { applyGlbHighlight } from '../src/domain/glb-highlight.js';

function material(hex, intensity) {
  return {
    emissive: {
      hex,
      setHex(value) {
        this.hex = value;
      },
    },
    emissiveIntensity: intensity,
  };
}

test('an idle GLB material keeps its authored emissive glow', () => {
  const led = material(0x76ff03, 3);
  applyGlbHighlight(led, { isSelected: false, isRelated: false, isHovered: false });
  assert.equal(led.emissive.hex, 0x76ff03);
  assert.equal(led.emissiveIntensity, 3);
});

test('selection, related, and hover highlights replace emissive', () => {
  const selected = material(0x76ff03, 3);
  applyGlbHighlight(selected, { isSelected: true });
  assert.equal(selected.emissive.hex, 0xffffff);
  assert.equal(selected.emissiveIntensity, 0.3);

  const related = material(0x60a5fa, 2.8);
  applyGlbHighlight(related, { isRelated: true });
  assert.equal(related.emissive.hex, 0xffeb3b);
  assert.equal(related.emissiveIntensity, 0.4);

  const hovered = material(0x22c55e, 1.6);
  applyGlbHighlight(hovered, { isHovered: true });
  assert.equal(hovered.emissive.hex, 0x81c784);
  assert.equal(hovered.emissiveIntensity, 0.2);
});

test('materials without an emissive colour are left alone', () => {
  const basic = { color: 0xffffff };
  assert.equal(applyGlbHighlight(basic, { isSelected: true }), basic);
  assert.equal(basic.emissiveIntensity, undefined);
});
