import { test, expect } from './support/fixtures';
import { dragNodeBy, getCanvasOrigin } from './support/fixtures';

test.describe('Frames', () => {
  test('right-clicking empty canvas can add a frame', async ({ page }) => {
    const origin = await getCanvasOrigin(page);
    await page.mouse.click(origin.x + 400, origin.y + 300, { button: 'right' });
    await page.getByRole('button', { name: 'Add Frame' }).click();

    await expect(page.getByText('New Frame')).toBeVisible();
  });

  test('double-clicking a frame label opens the rename dialog', async ({ page }) => {
    const origin = await getCanvasOrigin(page);
    await page.mouse.click(origin.x + 400, origin.y + 300, { button: 'right' });
    await page.getByRole('button', { name: 'Add Frame' }).click();

    await page.getByText('New Frame').dblclick();
    await expect(page.getByRole('heading', { name: 'Rename Frame' })).toBeVisible();

    await page.locator('input[placeholder="Enter name..."]').fill('Smelting Line');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Smelting Line')).toBeVisible();
  });

  test('deleting a frame with machines inside asks for confirmation before removing both', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();

    // Move the machine away from the top-left corner first: the collapsed
    // "Machine Stats" panel is a sibling overlay pinned there, and a
    // right-click on it never reaches the canvas's own context menu.
    await dragNodeBy(page, 'Machine 1', 350, 350);

    const origin = await getCanvasOrigin(page);
    await page.mouse.click(origin.x + 380, origin.y + 380, { button: 'right' });
    await page.getByRole('button', { name: 'Add Frame' }).click();

    await page.getByText('New Frame').click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete Frame' }).click();

    await expect(page.getByRole('heading', { name: 'Delete Frame & Contents' })).toBeVisible();
    await expect(page.getByText(/will also remove 1 machine/)).toBeVisible();

    // Cancel first: both the frame and the machine should survive.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('New Frame')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();

    // Now confirm: both should be gone.
    await page.getByText('New Frame').click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete Frame' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByText('New Frame')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Machine Stats 0' })).toBeVisible();
  });
});
