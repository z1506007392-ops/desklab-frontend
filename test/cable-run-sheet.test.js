import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCableRunSheet } from '../src/domain/cable-run-sheet.js';
import { DESK_TEMPLATES, buildTemplateScene } from '../src/domain/desk-templates.js';

function device(id, position, port, extra = {}) {
  return {
    id,
    name: id,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    ports: [port],
    ...extra,
  };
}

const hdmiOut = { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' };
const hdmiIn = { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' };
const acOut = { id: 'ac-out', name: '插孔', type: 'ac_output', direction: 'output' };
const acIn = { id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' };

test('the run sheet names both ends, the route and the shop length', () => {
  const objects = [
    device('主机', { x: 0, y: 0, z: 0 }, hdmiOut),
    device('显示器', { x: 1, y: 0, z: 0 }, hdmiIn),
  ];
  const connections = [{
    id: 'secret-id',
    name: '视频线',
    cableType: 'hdmi',
    length: 2,
    fromObjectId: '主机',
    fromPortId: 'hdmi-out',
    toObjectId: '显示器',
    toPortId: 'hdmi-in',
  }];
  const sheet = buildCableRunSheet(connections, objects);
  assert.equal(sheet.rows.length, 1);
  assert.equal(sheet.rows[0].fromDevice, '主机');
  assert.equal(sheet.rows[0].fromPort, 'HDMI 输出');
  assert.equal(sheet.rows[0].toDevice, '显示器');
  assert.equal(sheet.rows[0].toPort, 'HDMI 输入');
  assert.equal(sheet.rows[0].typeLabel, 'HDMI 线');
  assert.ok(Math.abs(sheet.rows[0].routeMetres - 1) < 0.02);
  assert.equal(sheet.rows[0].shopMetres, 1.5);
  assert.match(sheet.markdown, /\| 主机 \| HDMI 输出 \| 显示器 \| HDMI 输入 \| HDMI 线 \| 1 \| 1\.5 \|/);
  assert.match(sheet.markdown, /先接电源，再接信号/);
  assert.match(sheet.markdown, /从「主机」的「HDMI 输出」接到「显示器」的「HDMI 输入」/);
  assert.doesNotMatch(sheet.markdown, /secret-id/);
  assert.ok(sheet.csv.startsWith('\uFEFF'));
  assert.match(sheet.csv, /起点设备,起点接口,终点设备,终点接口,类型,走线长度（米）,购买长度（米）/);
  assert.match(sheet.csv, /主机,HDMI 输出,显示器,HDMI 输入,HDMI 线,1,1\.5/);
});

test('the install list plugs power in before signal, upstream first', () => {
  const objects = [
    device('墙插', { x: 0, y: 0, z: 0 }, acOut),
    device('插排', { x: 0.4, y: 0, z: 0 }, { ...acIn, id: 'ac-in' }),
    device('主机', { x: 1, y: 0, z: 0 }, hdmiOut),
    device('显示器', { x: 2, y: 0, z: 0 }, hdmiIn),
  ];
  objects[1].ports = [acIn, { ...acOut, id: 'ac-out', name: '插孔' }];
  objects[2].ports = [hdmiOut, { ...acIn, id: 'ac-in', name: '电源输入' }];
  const connections = [
    { id: 'video', cableType: 'hdmi', length: 2, fromObjectId: '主机', fromPortId: 'hdmi-out', toObjectId: '显示器', toPortId: 'hdmi-in' },
    { id: 'pc-power', cableType: 'power', length: 1, fromObjectId: '插排', fromPortId: 'ac-out', toObjectId: '主机', toPortId: 'ac-in' },
    { id: 'strip-power', cableType: 'power', length: 1, fromObjectId: '墙插', fromPortId: 'ac-out', toObjectId: '插排', toPortId: 'ac-in' },
  ];
  const sheet = buildCableRunSheet(connections, objects);
  assert.deepEqual(sheet.rows.map(row => row.cableType), ['hdmi', 'power', 'power']);
  assert.deepEqual(sheet.installRows.map(row => row.fromDevice), ['墙插', '插排', '主机']);
  const steps = sheet.markdown.split('# 安装清单')[1];
  const powerAt = steps.indexOf('电源线：从「墙插」');
  const nextPower = steps.indexOf('电源线：从「插排」');
  const signalAt = steps.indexOf('HDMI 线');
  assert.ok(powerAt >= 0 && powerAt < nextPower && nextPower < signalAt);
});

test('names that contain commas stay inside one CSV cell, and a keyboard cable is built in', () => {
  const usb = { id: 'usb-1', name: 'USB', type: 'usb', direction: 'bidirectional' };
  const objects = [
    device('主机,甲', { x: 0, y: 0, z: 0 }, usb),
    { ...device('键盘', { x: 0.3, y: 0, z: 0 }, usb), type: 'keyboard', modelId: 'keyboard' },
  ];
  const sheet = buildCableRunSheet([{
    id: 'k', cableType: 'usb', length: 1, fromObjectId: '主机,甲', fromPortId: 'usb-1', toObjectId: '键盘', toPortId: 'usb-1',
  }], objects);
  assert.equal(sheet.rows[0].builtIn, true);
  assert.equal(sheet.rows[0].shopMetres, null);
  assert.match(sheet.csv, /"主机,甲",USB,键盘,USB,USB 线,/);
  assert.match(sheet.csv, /,自带/);
  assert.match(sheet.markdown, /自带/);
  assert.match(sheet.markdown, /不用另买/);
});

test('a line break or a pipe in a name stays inside one install step', () => {
  const objects = [
    device('主机\n# 标题', { x: 0, y: 0, z: 0 }, { ...hdmiOut, name: 'HDMI\n输出' }),
    device('显示器|甲', { x: 1, y: 0, z: 0 }, hdmiIn),
  ];
  const sheet = buildCableRunSheet([{
    id: 'v', cableType: 'hdmi', length: 2,
    fromObjectId: '主机\n# 标题', fromPortId: 'hdmi-out',
    toObjectId: '显示器|甲', toPortId: 'hdmi-in',
  }], objects);
  const install = sheet.markdown.split('# 安装清单')[1];
  assert.match(install, /从「主机 # 标题」的「HDMI 输出」接到「显示器∣甲」的「HDMI 输入」/);
  assert.doesNotMatch(install, /主机\n/);
  assert.match(sheet.markdown, /\| 主机 # 标题 \| HDMI 输出 \| 显示器∣甲 \| HDMI 输入 \|/);
  assert.match(sheet.csv, /"主机\n# 标题"/);
});

test('an empty project exports an empty sheet', () => {
  const sheet = buildCableRunSheet([], []);
  assert.deepEqual(sheet.rows, []);
  assert.match(sheet.markdown, /当前没有需要列出的线/);
  assert.match(sheet.csv, /起点设备,起点接口/);
});

test('every template cable is on the sheet and the install list starts with power', () => {
  for (const template of DESK_TEMPLATES) {
    const scene = buildTemplateScene(template.id);
    const sheet = buildCableRunSheet(scene.connections, scene.objects);
    assert.equal(sheet.rows.length, scene.connections.length, template.name);
    assert.equal(sheet.installRows[0].cableType, 'power', template.name);
    for (const connection of scene.connections) {
      assert.doesNotMatch(sheet.markdown, new RegExp(connection.id), connection.id);
    }
  }
});
