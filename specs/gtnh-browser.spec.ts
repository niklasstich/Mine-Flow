import { test, expect } from './support/fixtures';

test.describe('GTNH recipe browser', () => {
  test('searching an item, picking a machine tab and recipe adds a configured node', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse GTNH' }).click();
    await expect(page.getByRole('heading', { name: 'Browse GTNH Recipes' })).toBeVisible();

    await page.getByPlaceholder('Search items & fluids...').fill('Iron Ingot');
    await page.getByRole('button', { name: 'Iron Ingot minecraft item' }).click();

    await page.getByRole('button', { name: /^Furnace \(\d+\)$/ }).click();
    await page.getByRole('button', { name: 'Iron Ore → Iron Ingot' }).first().click();

    await expect(page.getByRole('button', { name: 'Add to Canvas' })).toBeVisible();
    await page.getByRole('button', { name: 'Add to Canvas' }).click();

    // Dialog closes and the new node lands on the canvas.
    await expect(page.getByRole('heading', { name: 'Browse GTNH Recipes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();
    await expect(page.getByText('Furnace', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Input: Iron Ore (item)')).toBeVisible();
    await expect(page.getByTitle('Output: Iron Ingot (item)')).toBeVisible();
  });

  test('closing the dialog without picking a recipe adds nothing', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse GTNH' }).click();
    await page.getByPlaceholder('Search items & fluids...').fill('Iron Ingot');
    await page.getByRole('button', { name: 'Iron Ingot minecraft item' }).click();

    // Close (X) button is a sibling of the heading's wrapper div.
    await page.getByRole('heading', { name: 'Browse GTNH Recipes' }).locator('xpath=../following-sibling::button[1]').click();

    await expect(page.getByRole('heading', { name: 'Browse GTNH Recipes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Machine Stats 0' })).toBeVisible();
  });
});
