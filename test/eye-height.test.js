import test from 'node:test';
import assert from 'node:assert/strict';

import {
  eyeHeightAdvice,
  parseEyeProfile,
  readEyeProfile,
  writeEyeProfile,
  EYE_HEIGHT_STORAGE_KEY,
} from '../src/domain/eye-height.js';

function desk(scaleY = 0.7) {
  return {
    id: 'desk',
    name: '书桌',
    type: 'furniture',
    modelId: 'office-desk',
    shape: 'box',
    position: { x: 0, y: 0, z: 0.375 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1.4, y: scaleY, z: 0.75 },
    ports: [],
  };
}

function screen({ y, z = 0.975, height = 0.45, name = '27 英寸显示器' }) {
  return {
    id: 'screen',
    name,
    type: 'monitor',
    modelId: 'monitor-27',
    shape: 'box',
    position: { x: 0, y, z },
    rotation: { x: 0, y: 0, z: 180 },
    scale: { x: 0.62, y: 0.2, z: height },
    ports: [],
  };
}

const sitting = (eyeHeightMetres, extra = {}) => ({ eyeHeightMetres, posture: 'sitting', bifocals: false, ...extra });

test('without an eye height the sentence only asks for one', () => {
  const sentence = eyeHeightAdvice({ objects: [desk(), screen({ y: 0.15 })] }, sitting(null));
  assert.match(sentence, /填上眼睛离地/);
  assert.match(sentence, /不会自动挪/);
  assert.doesNotMatch(sentence, /椅子|元|¥/);
});

test('a screen whose top is above the eyes gets one sentence and no movement', () => {
  const sentence = eyeHeightAdvice(
    { objects: [desk(), screen({ y: 0.15 })] },
    sitting(1.05, { bifocals: true }),
  );
  assert.match(sentence, /坐着、眼睛离地 105 厘米/);
  assert.match(sentence, /上沿高过眼睛/);
  assert.match(sentence, /朝上倾/);
  assert.equal(typeof sentence, 'string');
});

test('the comfortable range is 50 to 100 centimetres from the eye', () => {
  const sentence = eyeHeightAdvice({ objects: [desk(), screen({ y: 0.15 })] }, sitting(1.2));
  assert.match(sentence, /上沿没有高过眼睛/);
  assert.match(sentence, /50 到 100 厘米/);
  assert.match(sentence, /78 厘米/);
});

test('an eye-to-screen distance under 50 centimetres names the other 0.45 metre rule', () => {
  const sentence = eyeHeightAdvice({ objects: [desk(), screen({ y: -0.2 })] }, sitting(1.2));
  assert.match(sentence, /比常见的 50 厘米近/);
  assert.match(sentence, /座位到屏幕近边不到 0\.45 米/);
});

test('a long eye-to-screen distance is one sentence about 100 centimetres', () => {
  const sentence = eyeHeightAdvice(
    { objects: [desk(1.6), screen({ y: 0.5 })] },
    { eyeHeightMetres: 1.2, posture: 'standing', bifocals: false },
  );
  assert.match(sentence, /站着/);
  assert.match(sentence, /比常见的 100 厘米远/);
});

test('bifocals ask to lower a screen that is already at eye level but nearly straight ahead', () => {
  const sentence = eyeHeightAdvice(
    { objects: [desk(), screen({ y: 0.15, z: 0.85, height: 0.2 })] },
    sitting(1, { bifocals: true }),
  );
  assert.match(sentence, /双光眼镜/);
  assert.match(sentence, /放低/);
  assert.doesNotMatch(sentence, /上沿高过眼睛/);
});

test('no screen on a desk cannot be compared', () => {
  const sentence = eyeHeightAdvice({ objects: [desk()] }, sitting(1.18));
  assert.match(sentence, /没有放在桌面上的屏幕/);
});

test('the profile stays on this machine and ignores a broken save', () => {
  const saved = new Map();
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key),
  };
  assert.equal(writeEyeProfile(storage, sitting(1.15, { posture: 'standing', bifocals: true })), true);
  assert.equal(saved.has(EYE_HEIGHT_STORAGE_KEY), true);
  assert.deepEqual(readEyeProfile(storage), { eyeHeightMetres: 1.15, posture: 'standing', bifocals: true });
  assert.deepEqual(parseEyeProfile('not json'), { eyeHeightMetres: null, posture: 'sitting', bifocals: false });
  assert.equal(parseEyeProfile(JSON.stringify({ version: 1, eyeHeightMetres: 9 })).eyeHeightMetres, null);
});
