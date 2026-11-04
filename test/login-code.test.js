import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOGIN_CODE_ROLL_LIMIT,
  LOGIN_CODE_SPAN,
  loginCodeFromUint32,
  uniformLoginCode,
} from '../src/domain/login-code.js';

const UINT32_SPAN = 2 ** 32;

test('every login code has the same number of accepted rolls', () => {
  assert.equal(LOGIN_CODE_SPAN, 1000000);
  assert.equal(LOGIN_CODE_ROLL_LIMIT % LOGIN_CODE_SPAN, 0);
  assert.equal(LOGIN_CODE_ROLL_LIMIT / LOGIN_CODE_SPAN, 4294);
  assert.equal(UINT32_SPAN - LOGIN_CODE_ROLL_LIMIT, 967296);
  assert.ok(UINT32_SPAN - LOGIN_CODE_ROLL_LIMIT < LOGIN_CODE_SPAN);

  const copies = LOGIN_CODE_ROLL_LIMIT / LOGIN_CODE_SPAN;
  for (let residue = 0; residue < LOGIN_CODE_SPAN; residue += 1) {
    const text = String(residue).padStart(6, '0');
    assert.equal(loginCodeFromUint32(residue), text);
    assert.equal(loginCodeFromUint32(residue + (copies - 1) * LOGIN_CODE_SPAN), text);
  }
  assert.equal(loginCodeFromUint32(0), '000000');
  assert.equal(loginCodeFromUint32(42), '000042');
  assert.equal(loginCodeFromUint32(999999), '999999');
  assert.equal(loginCodeFromUint32(1000000), '000000');
  assert.equal(loginCodeFromUint32(LOGIN_CODE_ROLL_LIMIT - 1), '999999');
});

test('rolls in the biased tail are rejected instead of folded by modulo', () => {
  assert.equal(0xFFFFFFFF % LOGIN_CODE_SPAN, 967295);
  assert.equal(loginCodeFromUint32(LOGIN_CODE_ROLL_LIMIT), null);
  assert.equal(loginCodeFromUint32(0xFFFFFFFF), null);
  assert.equal(loginCodeFromUint32(LOGIN_CODE_ROLL_LIMIT + 967295), null);
  assert.equal(loginCodeFromUint32(-1), null);
  assert.equal(loginCodeFromUint32(1.5), null);
  assert.equal(loginCodeFromUint32(Number.NaN), null);

  const draws = [LOGIN_CODE_ROLL_LIMIT, 0xFFFFFFFF, 42];
  assert.equal(uniformLoginCode(() => draws.shift()), '000042');

  const rejected = Array.from({ length: 8 }, () => 0xFFFFFFFF);
  let extra = 7;
  assert.equal(uniformLoginCode(() => (rejected.length ? rejected.shift() : extra)), null);
  assert.equal(extra, 7);
});
