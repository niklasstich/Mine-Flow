import { test, expect } from './support/fixtures';

test.describe('Machine nodes', () => {
  test('Add Machine creates a node with the default recipe', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();

    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();
    await expect(page.getByText('Machine 1', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Input: Iron Ore (item)')).toBeVisible();
    await expect(page.getByTitle('Output: Iron Ingot (item)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeEnabled();
  });

  test('Edit Recipe renames the node and updates its recipe', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByTitle('Edit Recipe').first().click();

    await expect(page.getByRole('heading', { name: 'Configure Machine' })).toBeVisible();
    await page.getByPlaceholder('e.g. Electric Furnace').fill('Iron Foundry');

    // Add a second output slot and give it a name. Scoped to the Outputs
    // section: an unscoped "Add" button match is ambiguous with the header's
    // "Add Machine" button, which is still in the DOM behind the dialog.
    const outputsSection = page.locator('div.space-y-2').filter({ has: page.locator('h3', { hasText: 'Outputs' }) });
    await outputsSection.getByRole('button', { name: 'Add', exact: true }).click();
    await outputsSection.getByPlaceholder('Item Name').nth(1).fill('Slag');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Iron Foundry', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Output: Slag (item)')).toBeVisible();
  });

  test('Duplicate Machine clones the node with a (Copy) suffix', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByTitle('Duplicate Machine').first().click();

    await expect(page.getByRole('button', { name: 'Machine Stats 2' })).toBeVisible();
    await expect(page.getByText('Machine 1 (Copy)', { exact: true })).toBeVisible();
  });

  test('Delete Machine removes the node from the canvas', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();

    await page.getByTitle('Delete Machine').first().click();

    await expect(page.getByRole('button', { name: 'Machine Stats 0' })).toBeVisible();
    await expect(page.getByText('Machine 1', { exact: true })).toHaveCount(0);
  });

  test('Undo and Redo step through node history', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();

    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
    await expect(page.getByRole('button', { name: 'Machine Stats 0' })).toBeVisible();

    await page.getByRole('button', { name: 'Redo (Ctrl+Y)' }).click();
    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();
  });
});
