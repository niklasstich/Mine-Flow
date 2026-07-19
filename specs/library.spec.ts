import { test, expect } from './support/fixtures';
import { dragLibraryItemToCanvas, dragNodeBy, getCanvasOrigin } from './support/fixtures';

test.describe('Library', () => {
  test('dragging the built-in Generic Machine onto the canvas adds a node', async ({ page }) => {
    const origin = await getCanvasOrigin(page);
    await dragLibraryItemToCanvas(page, 'Generic Machine', { x: origin.x + 400, y: origin.y + 300 });

    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();
    // One "Generic Machine" text in the sidebar entry, one in the new node's header.
    await expect(page.getByText('Generic Machine', { exact: true })).toHaveCount(2);
  });

  test('saving a node to the library adds it under Custom and it can be re-added', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();

    await page.getByText('Machine 1', { exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Save to Library' }).click();

    await expect(page.getByRole('heading', { name: 'Save Machine' })).toBeVisible();
    await page.locator('input[placeholder="Enter name..."]').fill('Iron Line');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Custom', { exact: true })).toBeVisible();
    await expect(page.locator('div[draggable="true"]:has-text("Iron Line")')).toBeVisible();

    // Re-add it to the canvas from the library.
    const origin = await getCanvasOrigin(page);
    await dragLibraryItemToCanvas(page, 'Iron Line', { x: origin.x + 400, y: origin.y + 300 });
    await expect(page.getByRole('button', { name: 'Machine Stats 2' })).toBeVisible();
  });

  test('editing a custom library machine updates its recipe', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByText('Machine 1', { exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Save to Library' }).click();
    await page.locator('input[placeholder="Enter name..."]').fill('Iron Line');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Save' }).click();

    await page.locator('div[draggable="true"]:has-text("Iron Line")').getByTitle('Edit Machine').click();
    // RecipeDialog's heading is driven purely by `mode`, so editing an
    // existing prefab shows the same "Create New Machine" title as creating
    // one; only the footer button ("Save Machine") differs.
    await expect(page.getByRole('heading', { name: 'Create New Machine' })).toBeVisible();
    await page.getByPlaceholder('e.g. Electric Furnace').fill('Iron Line v2');
    await page.getByRole('button', { name: 'Save Machine' }).click();

    await expect(page.locator('div[draggable="true"]:has-text("Iron Line v2")')).toBeVisible();
  });

  test('deleting a custom library machine removes it', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByText('Machine 1', { exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Save to Library' }).click();
    await page.locator('input[placeholder="Enter name..."]').fill('Iron Line');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Save' }).click();

    const entry = page.locator('div[draggable="true"]:has-text("Iron Line")');
    await entry.getByTitle('Delete Machine').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirmation dialog

    await expect(entry).toHaveCount(0);
  });

  test('saving a frame as a Process Line lists it under the Process Lines tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    // Move off the top-left corner: the "Machine Stats" overlay sits there
    // and swallows right-clicks meant for the canvas's own context menu.
    await dragNodeBy(page, 'Machine 1', 350, 350);

    const origin = await getCanvasOrigin(page);
    await page.mouse.click(origin.x + 380, origin.y + 380, { button: 'right' });
    await page.getByRole('button', { name: 'Add Frame' }).click();

    await page.getByText('New Frame').click({ button: 'right' });
    await page.getByRole('button', { name: 'Save to Library' }).click();

    await expect(page.getByRole('heading', { name: 'Save Process Line' })).toBeVisible();
    await page.locator('input[placeholder="Enter name..."]').fill('Smelting Line');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Process Lines' }).click();
    await expect(page.getByText('Smelting Line', { exact: true })).toBeVisible();
  });
});
