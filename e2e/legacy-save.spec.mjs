import { test, expect } from '@playwright/test';
import { openProject, waitForSceneDownloads } from './project-fixture.mjs';

function device(id, type, category, modelId, position, scale, ports) {
  return {
    id, name: id, type, category, modelId, shape: 'rect',
    position, rotation: { x: 0, y: 0, z: 0 }, scale, ports,
  };
}

test('an old save with a closed-lid laptop and removed devices still opens', async ({ page }) => {
  const staleAnchor = { x: 0, y: 0.5, z: -0.25 };
  const objects = [
    device('desk', 'office-desk', 'furniture', 'office-desk', { x: 0, y: 0, z: 0.375 }, { x: 1.4, y: 0.7, z: 0.75 }, []),
    device('laptop', 'laptop', 'computer', 'laptop-15', { x: -0.3, y: 0, z: 0.75 + 0.058 / 2 }, { x: 0.36, y: 0.28, z: 0.058 }, [
      { id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input', anchor: staleAnchor },
      { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output', anchor: staleAnchor },
    ]),
    device('monitor', 'monitor', 'display', 'monitor-24', { x: 0.3, y: 0.2, z: 0.91 }, { x: 0.54, y: 0.05, z: 0.32 }, [
      { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input', anchor: staleAnchor },
    ]),
    device('mini', 'mini-pc', 'computer', 'mini-pc', { x: 0.5, y: -0.2, z: 0.775 }, { x: 0.12, y: 0.12, z: 0.05 }, [
      { id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input', anchor: staleAnchor },
    ]),
    device('aio', 'all-in-one', 'computer', 'all-in-one', { x: 1.5, y: 1, z: 0.225 }, { x: 0.6, y: 0.2, z: 0.45 }, []),
  ];
  const connections = [{
    id: 'video', fromObjectId: 'laptop', fromPortId: 'hdmi-out', toObjectId: 'monitor', toPortId: 'hdmi-in',
    cableType: 'hdmi', length: 1.5, name: '视频线',
  }];

  const evidence = await openProject(page, objects, connections);
  await expect(page.locator('canvas')).toBeVisible();
  // A fixed 1500 ms wait ended before a late model failure. Wait until every
  // catalog model has finished, the same condition used before a reload.
  await waitForSceneDownloads(page);
  // Migrating the old save is part of loading it, not an edit to save.
  const unsaved = page.getByRole('status').filter({ hasText: /^未保存$/ });
  await expect(unsaved).toHaveCount(0);
  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});
