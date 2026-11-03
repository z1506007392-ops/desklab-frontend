import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { brotliDecode, compressGlbDirectory, isGlb } from '../tools/static-delivery.mjs';

test('brotli of a catalog GLB round-trips and shrinks', () => {
  const raw = readFileSync(new URL('../public/models/desk-lamp.glb', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'desklab-glb-'));
  writeFileSync(join(dir, 'desk-lamp.glb'), raw);
  const result = compressGlbDirectory(dir);
  assert.equal(result.files.length, 1);
  assert.ok(result.after < result.before);
  const stored = readFileSync(join(dir, 'desk-lamp.glb'));
  assert.equal(isGlb(stored), false);
  assert.ok(brotliDecode(stored).equals(raw));
});
