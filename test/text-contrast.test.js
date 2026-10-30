import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Grey body text was #888 in several places, 3.5:1 on white, below the 4.5:1
// WCAG AA minimum. Scan stylesheets and inline styles for grey text colours
// that are too light. Disabled controls are exempt (WCAG 1.4.3) and white
// text sits on coloured buttons, so only light greys short of white count.
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function luminance(hex) {
  const full = hex.length === 4 ? hex.replace(/\w/g, c => c + c) : hex;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return { value: 0.2126 * r + 0.7152 * g + 0.0722 * b, spread: Math.max(r, g, b) - Math.min(r, g, b) };
}

function isTooLightGrey(hex) {
  const { value, spread } = luminance(hex.toLowerCase());
  const contrastOnWhite = 1.05 / (value + 0.05);
  return spread < 0.08 && value < 0.95 && contrastOnWhite < 4.5;
}

test('stylesheet text colours meet 4.5:1 outside disabled states', () => {
  const css = source('src/App.css') + source('src/index.css');
  const offenders = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (/disabled/.test(selector)) continue;
    for (const [, hex] of body.matchAll(/(?:^|[\s;])color:\s*(#[0-9a-fA-F]{3,6})\b/g)) {
      if (isTooLightGrey(hex)) offenders.push(`${selector.trim()} → ${hex}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('inline text colours in components meet 4.5:1', () => {
  const files = ['src/App.jsx', ...readdirSync(new URL('../src/components', import.meta.url)).map(f => `src/components/${f}`)];
  const offenders = [];
  for (const file of files) {
    for (const [, hex] of source(file).matchAll(/\bcolor:\s*['"](#[0-9a-fA-F]{3,6})['"]/g)) {
      if (isTooLightGrey(hex)) offenders.push(`${file} → ${hex}`);
    }
  }
  assert.deepEqual(offenders, []);
});
