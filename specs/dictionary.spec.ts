import { test, expect } from './support/fixtures';

test.describe('Dictionary editor', () => {
  test('editing a resource type label persists after saving and reopening', async ({ page }) => {
    await page.getByRole('button', { name: 'Dictionary' }).click();
    await expect(page.getByRole('heading', { name: 'Dictionary Editor' })).toBeVisible();

    // "Item" is the first resource type and is active by default.
    const labelInput = page.locator('label:has-text("Display Label")').locator('xpath=following-sibling::input[1]');
    await labelInput.fill('Solid Item');
    await page.getByRole('button', { name: 'Save Dictionary' }).click();

    await page.getByRole('button', { name: 'Dictionary' }).click();
    await expect(page.getByRole('button', { name: 'Solid Item' })).toBeVisible();
  });

  test('adding a new resource type shows it in the sidebar list', async ({ page }) => {
    await page.getByRole('button', { name: 'Dictionary' }).click();
    await page.getByRole('button', { name: 'Add Resource Type' }).click();

    await page.getByPlaceholder('ID (e.g. magic)').fill('mana');
    await page.getByPlaceholder('Label (e.g. Magic)').fill('Mana');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Mana' })).toBeVisible();
  });

  test('resetting to defaults asks for confirmation and restores the built-in types', async ({ page }) => {
    await page.getByRole('button', { name: 'Dictionary' }).click();
    await page.getByRole('button', { name: 'Add Resource Type' }).click();
    await page.getByPlaceholder('ID (e.g. magic)').fill('mana');
    await page.getByPlaceholder('Label (e.g. Magic)').fill('Mana');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mana' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset Defaults' }).click();
    await expect(page.getByRole('heading', { name: 'Reset Dictionary' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); // ConfirmationDialog's confirm button

    await expect(page.getByRole('button', { name: 'Mana' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Item' })).toBeVisible();
  });
});
