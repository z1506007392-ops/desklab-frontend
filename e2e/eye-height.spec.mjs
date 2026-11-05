import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

test('eye height stays on this machine and adds one sentence', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(dialog.getByRole('status')).toContainText('填上眼睛离地');
  await expect(dialog).toContainText('不加椅子');
  await expect(dialog).toContainText('也不自动挪屏幕');
  // The metre field and its unit stay inside the dialog, even on a phone.
  const dialogBox = await dialog.boundingBox();
  const unitBox = await dialog.getByText('米', { exact: true }).boundingBox();
  expect(unitBox.x + unitBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
  expect(unitBox.width).toBeLessThan(40);
  await dialog.getByRole('button', { name: '站着', exact: true }).click();
  await dialog.getByLabel('离地').fill('1.18');
  await dialog.getByLabel('离地').press('Enter');
  await dialog.getByRole('checkbox', { name: '双光眼镜' }).check();
  await expect(dialog.getByRole('status')).toContainText('站着、眼睛离地 118 厘米');
  await expect(dialog.getByRole('status')).toContainText('没有放在桌面上的屏幕');
  await expect(dialog.getByRole('button', { name: '让 AI 看看', exact: true })).toBeDisabled();

  await page.reload();
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const again = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(again.getByLabel('离地')).toHaveValue('1.18');
  await expect(again.getByRole('button', { name: '站着', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(again.getByRole('checkbox', { name: '双光眼镜' })).toBeChecked();
  expect(evidence.errors).toEqual([]);
  expect(evidence.writes).toEqual([]);
});
