import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';
import { decodePng } from './png-pixels.mjs';

async function addFromLibrary(page, name) {
  const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
  if (await openLibrary.isVisible()) await openLibrary.click();
  await page.getByPlaceholder('搜索设备名称、类型、型号...').fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  const closeLibrary = page.getByRole('button', { name: '收起资产库', exact: true });
  if (page.viewportSize().width < 900 && await closeLibrary.isVisible()) await closeLibrary.click();
}

async function readField(page, label) {
  const openPanel = page.getByRole('button', { name: '展开属性面板', exact: true });
  if (await openPanel.isVisible()) await openPanel.click();
  const value = Number(await page.getByLabel(label, { exact: true }).inputValue());
  const closePanel = page.getByRole('button', { name: '收起属性面板', exact: true });
  if (page.viewportSize().width < 900 && await closePanel.isVisible()) await closePanel.click();
  return value;
}

function matches(data, index, channel) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  if (channel === 'red') return red >= 210 && green <= 60 && blue <= 60;
  return blue >= 210 && red <= 60 && green <= 60;
}

// The far end of the colored handle nearest the device. The corner axes use
// the same colors, so pixels are grouped and the group closest to the tag wins.
function findHandle(image, canvasBox, anchor, channel) {
  const scaleX = image.width / canvasBox.width;
  const scaleY = image.height / canvasBox.height;
  const anchorX = (anchor.x - canvasBox.x) * scaleX;
  const anchorY = (anchor.y - canvasBox.y) * scaleY;
  const maxRadius = 220 * Math.max(scaleX, scaleY);
  const join = 28 * Math.max(scaleX, scaleY);
  const pixels = [];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      if (!matches(image.data, index, channel)) continue;
      const distance = Math.hypot(x - anchorX, y - anchorY);
      if (distance <= maxRadius) pixels.push({ x, y, distance });
    }
  }
  const clusters = [];
  for (const pixel of pixels) {
    const cluster = clusters.find(group => group.some(other => Math.hypot(other.x - pixel.x, other.y - pixel.y) <= join));
    if (cluster) cluster.push(pixel);
    else clusters.push([pixel]);
  }
  let chosen = null;
  let chosenDistance = Infinity;
  for (const cluster of clusters) {
    const centerX = cluster.reduce((sum, pixel) => sum + pixel.x, 0) / cluster.length;
    const centerY = cluster.reduce((sum, pixel) => sum + pixel.y, 0) / cluster.length;
    const distance = Math.hypot(centerX - anchorX, centerY - anchorY);
    if (distance < chosenDistance) {
      chosenDistance = distance;
      chosen = cluster;
    }
  }
  // The corner axes use the same colours and sit farther from the device.
  if (!chosen || chosenDistance > 120 * Math.max(scaleX, scaleY)) return null;
  const tip = chosen.reduce((far, pixel) => (pixel.distance > far.distance ? pixel : far));
  return {
    pageX: canvasBox.x + (tip.x + 0.5) / scaleX,
    pageY: canvasBox.y + (tip.y + 0.5) / scaleY,
  };
}

async function handleNearTag(page, channel) {
  const tag = page.locator('.scene-tag');
  await expect(tag).toBeVisible();
  const canvas = page.locator('canvas');
  let hit = null;
  let anchor = null;
  for (let attempt = 0; attempt < 6 && !hit; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 400 : 250);
    const tagBox = await tag.boundingBox();
    const canvasBox = await canvas.boundingBox();
    anchor = { x: tagBox.x + tagBox.width / 2, y: tagBox.y + tagBox.height / 2 };
    hit = findHandle(decodePng(await canvas.screenshot()), canvasBox, anchor, channel);
  }
  expect(hit, `a ${channel} handle near the selected device`).not.toBeNull();
  return { hit, anchor };
}

async function drag(page, from, to) {
  await page.mouse.move(from.pageX, from.pageY);
  await page.mouse.down();
  await page.mouse.move(to.pageX, to.pageY, { steps: 12 });
  await page.mouse.up();
}

function extendPast(anchor, hit, distance) {
  const dx = hit.pageX - anchor.x;
  const dy = hit.pageY - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    pageX: hit.pageX + (dx / length) * distance,
    pageY: hit.pageY + (dy / length) * distance,
  };
}

function dragTangent(anchor, hit, distance) {
  const dx = hit.pageX - anchor.x;
  const dy = hit.pageY - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    pageX: hit.pageX + (-dy / length) * distance,
    pageY: hit.pageY + (dx / length) * distance,
  };
}

test('move and rotate controls show only while a device is selected', async ({ page }) => {
  const evidence = await openProject(page, []);
  const modes = page.getByRole('group', { name: '控制柄' });
  await expect(modes).toHaveCount(0);

  await addFromLibrary(page, '电源适配器');
  await expect(modes).toBeVisible();
  await expect(modes.getByRole('button', { name: '移动', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(modes.getByRole('button', { name: '旋转', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await modes.getByRole('button', { name: '旋转', exact: true }).click();
  await expect(modes.getByRole('button', { name: '旋转', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(modes.getByRole('button', { name: '移动', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await modes.getByRole('button', { name: '移动', exact: true }).click();
  const canvas = page.locator('canvas');
  const view = await canvas.boundingBox();
  await canvas.click({ position: { x: view.width / 2, y: 20 } });
  await expect(modes).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('dragging a handle moves or turns the device, and one undo puts it back', async ({ page }) => {
  const evidence = await openProject(page, []);
  await addFromLibrary(page, '电源适配器');

  const beforeX = await readField(page, '左右 X');
  const beforeY = await readField(page, '前后 Y');
  let movedX = beforeX;
  for (let attempt = 0; attempt < 2 && Math.abs(movedX - beforeX) < 0.01; attempt += 1) {
    const move = await handleNearTag(page, 'red');
    await drag(page, move.hit, extendPast(move.anchor, move.hit, attempt === 0 ? 110 : 160));
    movedX = await readField(page, '左右 X');
  }
  expect(movedX).not.toBeCloseTo(beforeX, 2);
  expect(await readField(page, '前后 Y')).toBeCloseTo(beforeY, 2);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readField(page, '左右 X')).toBeCloseTo(beforeX, 3);

  await page.getByRole('button', { name: '旋转', exact: true }).click();
  const beforeRotation = await readField(page, '旋转 (°)');
  const turn = await handleNearTag(page, 'blue');
  await drag(page, turn.hit, dragTangent(turn.anchor, turn.hit, 120));
  const turned = await readField(page, '旋转 (°)');
  expect(turned).not.toBeCloseTo(beforeRotation, 0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(await readField(page, '旋转 (°)')).toBeCloseTo(beforeRotation, 3);

  expect(evidence).toEqual({ errors: [], writes: [] });
});
