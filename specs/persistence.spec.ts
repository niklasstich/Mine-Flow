import { test, expect } from './support/fixtures';

test.describe('LocalStorage persistence', () => {
  test('nodes, edges and a renamed frame survive a full page reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByTitle('Edit Recipe').first().click();
    await page.getByPlaceholder('e.g. Electric Furnace').fill('Persistent Machine');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Persistent Machine', { exact: true })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();
    await expect(page.getByText('Persistent Machine', { exact: true })).toBeVisible();
  });

  test('the library (saved machines) survives a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByText('Machine 1', { exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Save to Library' }).click();
    await page.locator('input[placeholder="Enter name..."]').fill('Iron Line');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Save' }).click();

    await page.reload();

    await expect(page.locator('div[draggable="true"]:has-text("Iron Line")')).toBeVisible();
  });
});
