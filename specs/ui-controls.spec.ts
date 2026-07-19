import { test, expect } from './support/fixtures';

test.describe('Canvas & UI controls', () => {
  test('zoom in/out/reset buttons update the displayed zoom percentage', async ({ page }) => {
    await expect(page.getByText('100%')).toBeVisible();

    await page.getByRole('button', { name: 'Zoom In' }).click();
    await expect(page.getByText('120%')).toBeVisible();

    await page.getByRole('button', { name: 'Zoom Out' }).click();
    await expect(page.getByText('100%')).toBeVisible();

    await page.getByRole('button', { name: 'Zoom In' }).click();
    await page.getByRole('button', { name: 'Reset View' }).click();
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('collapsing the library sidebar hides its contents', async ({ page }) => {
    await expect(page.getByText('Generic Machine')).toBeVisible();

    // Collapsing keeps the content in the DOM (width animates to 0 / display:none),
    // so assert on visibility rather than presence.
    await page.getByTitle('Collapse Library').click();
    await expect(page.getByText('Drag items to canvas to add')).toBeHidden();

    await page.getByTitle('Expand Library').click();
    await expect(page.getByText('Drag items to canvas to add')).toBeVisible();
  });

  test('Ctrl+K opens the search palette and jumps to a matching machine', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByTitle('Edit Recipe').first().click();
    await page.getByPlaceholder('e.g. Electric Furnace').fill('Findable Machine');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await page.keyboard.press('Control+k');
    const searchInput = page.getByPlaceholder('Search machines or items...');
    await expect(searchInput).toBeVisible();

    // The palette focuses its input via a delayed setTimeout, so drive the
    // field directly (.fill) instead of racing it with global keyboard.type.
    await searchInput.fill('Findable');
    // Scope to the palette's result button; the canvas node behind the
    // overlay also has "Findable Machine" as plain text.
    await expect(page.getByRole('button', { name: 'Findable Machine', exact: true })).toBeVisible();
    await searchInput.press('Enter');

    await expect(page.getByPlaceholder('Search machines or items...')).toHaveCount(0);
  });

  test('toggling Efficiency and Collapsed switches does not error out', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();

    await page.getByText('Efficiency').click();
    await page.getByText('Collapsed').click();

    // Collapsed view hides the per-socket item labels but keeps the node itself.
    await expect(page.getByText('Machine 1', { exact: true })).toBeVisible();

    await page.getByText('Efficiency').click();
    await page.getByText('Collapsed').click();
  });
});
