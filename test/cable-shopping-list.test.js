import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCableShoppingList, shopCableLength, CABLE_SHOP_SLACK_METRES } from '../src/domain/cable-shopping-list.js';

function device(id, position) {
  return {
    id,
    name: id,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    ports: [{ id: 'out', name: '口', type: 'hdmi', direction: 'output', anchor: { x: 0, y: 0, z: 0 } }],
  };
}

test('shop lengths round the path plus slack up to common sizes', () => {
  assert.equal(shopCableLength(0), 0.5);
  assert.equal(shopCableLength(0.5 - CABLE_SHOP_SLACK_METRES), 0.5);
  assert.equal(shopCableLength(0.31), 1);
  assert.equal(shopCableLength(1.4), 2);
  assert.equal(shopCableLength(4.9), 10);
});

test('the cable list merges the same kind and length and hides internal ids', () => {
  const objects = [
    device('hdmi-a', { x: 0, y: 0, z: 0 }),
    device('hdmi-b', { x: 0.3, y: 0, z: 0 }),
    device('hdmi-c', { x: 0, y: 0.3, z: 0 }),
  ];
  const connections = [
    { id: 'c1', fromObjectId: 'hdmi-a', fromPortId: 'out', toObjectId: 'hdmi-b', toPortId: 'out', cableType: 'hdmi', length: 1 },
    { id: 'c2', fromObjectId: 'hdmi-a', fromPortId: 'out', toObjectId: 'hdmi-c', toPortId: 'out', cableType: 'hdmi', length: 1 },
    { id: 'c3', fromObjectId: 'missing', fromPortId: 'nope', toObjectId: 'hdmi-a', toPortId: 'out', cableType: 'usb', length: 1 },
  ];
  const list = buildCableShoppingList(connections, objects);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].quantity, 2);
  assert.match(list.items[0].name, /HDMI 线/);
  assert.doesNotMatch(list.text, /hdmi-a|c1|out/);
  assert.match(list.text, /×2/);
});

test('usb, audio, and power use everyday names', () => {
  const left = device('左', { x: 0, y: 0, z: 0 });
  const right = device('右', { x: 0, y: 0, z: 0 });
  const list = buildCableShoppingList([
    { id: '1', fromObjectId: '左', fromPortId: 'out', toObjectId: '右', toPortId: 'out', cableType: 'usb', length: 1 },
    { id: '2', fromObjectId: '左', fromPortId: 'out', toObjectId: '右', toPortId: 'out', cableType: 'audio', length: 1 },
    { id: '3', fromObjectId: '左', fromPortId: 'out', toObjectId: '右', toPortId: 'out', cableType: 'power', length: 1 },
    { id: '4', fromObjectId: '左', fromPortId: 'out', toObjectId: '右', toPortId: 'out', cableType: 'displayport', length: 1 },
    { id: '5', fromObjectId: '左', fromPortId: 'out', toObjectId: '右', toPortId: 'out', cableType: 'ethernet', length: 1 },
    { id: '6', fromObjectId: '左', fromPortId: 'out', toObjectId: '右', toPortId: 'out', cableType: 'usb_c', length: 1 },
  ], [left, right]);
  const names = list.items.map(item => item.name).join('\n');
  assert.match(names, /USB-A 线/);
  assert.match(names, /3\.5mm 音频线/);
  assert.match(names, /电源线/);
  assert.match(names, /DP 线/);
  assert.match(names, /网线/);
  assert.match(names, /USB-C 线/);
});

test('an empty project says there is nothing to buy', () => {
  assert.equal(buildCableShoppingList([], []).text, '当前没有需要买的线');
});

test('a keyboard or mouse cable is built in, so it is not on the list', () => {
  const usb = { id: 'usb', name: 'USB', type: 'usb', direction: 'bidirectional', anchor: { x: 0, y: 0, z: 0 } };
  const objects = [
    { ...device('pc', { x: 0, y: 0, z: 0 }), ports: [{ ...usb, id: 'usb-1' }, { ...usb, id: 'usb-2' }, { ...usb, id: 'usb-3' }] },
    { ...device('keyboard', { x: 0.5, y: 0, z: 0 }), type: 'keyboard', modelId: 'keyboard', ports: [{ ...usb, id: 'usb-1' }] },
    { ...device('mouse', { x: 0.6, y: 0, z: 0 }), type: 'mouse', modelId: 'mouse', ports: [{ ...usb, id: 'usb-1' }] },
    { ...device('drive', { x: 0.4, y: 0, z: 0 }), type: 'storage', ports: [{ ...usb, id: 'usb-1' }] },
  ];
  const line = (id, to, fromPortId) => ({ id, cableType: 'usb', fromObjectId: 'pc', fromPortId, toObjectId: to, toPortId: 'usb-1' });
  const { items, text } = buildCableShoppingList([line('k', 'keyboard', 'usb-1'), line('m', 'mouse', 'usb-2'), line('d', 'drive', 'usb-3')], objects);
  assert.deepEqual(items.map(item => [item.name, item.quantity]), [['1 米 USB-A 线', 1]], 'only the drive needs a cable');
  assert.equal(text, '要买的线\n- 1 米 USB-A 线 ×1');
});
