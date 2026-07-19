import { test, expect } from './support/fixtures';
import { connectSockets, dragNodeBy } from './support/fixtures';

// Two machines are added per test, then pulled apart, since freshly spawned
// nodes land within ~20px of each other and their sockets would otherwise
// overlap (see fixtures.ts).
async function addTwoSeparatedMachines(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add Machine' }).click();
  await page.getByRole('button', { name: 'Add Machine' }).click();
  await expect(page.getByRole('button', { name: 'Machine Stats 2' })).toBeVisible();
  await dragNodeBy(page, 'Machine 2', 500, 0);
}

test.describe('Connections', () => {
  test('clicking two compatible sockets creates a connection', async ({ page }) => {
    await addTwoSeparatedMachines(page);

    await connectSockets(page, 'Output: Iron Ingot (item)', 'Input: Iron Ore (item)', {
      sourceIndex: 0,
      targetIndex: 1,
    });

    // The edge renders as an SVG path group with a rate label.
    await expect(page.locator('svg > g')).toHaveCount(1);
  });

  test('connecting mismatched resource types is rejected with an alert', async ({ page }) => {
    await addTwoSeparatedMachines(page);

    // Turn Machine 2's input into a fluid so it can't accept Machine 1's item output.
    await page.getByTitle('Edit Recipe').nth(1).click();
    await page.locator('div.space-y-2').filter({ has: page.locator('h3', { hasText: 'Inputs' }) }).locator('select').first().selectOption('fluid');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    let dialogMessage = '';
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message();
      dialog.accept();
    });

    await connectSockets(page, 'Output: Iron Ingot (item)', 'Input: Iron Ore (fluid)', {
      sourceIndex: 0,
      targetIndex: 0,
    });

    await expect.poll(() => dialogMessage).toContain('Cannot connect item to fluid');
    await expect(page.locator('svg > g')).toHaveCount(0);
  });

  test('double-clicking a connection opens the edit dialog and updates its capacity', async ({ page }) => {
    await addTwoSeparatedMachines(page);
    await connectSockets(page, 'Output: Iron Ingot (item)', 'Input: Iron Ore (item)', {
      sourceIndex: 0,
      targetIndex: 1,
    });

    // Native drag/hit-testing on a thin SVG path is unreliable from screen
    // coordinates; force the dblclick directly on the edge's hit-area group.
    await page.locator('svg > g').first().dblclick({ force: true });

    await expect(page.getByRole('heading', { name: 'Item Line' })).toBeVisible();
    await page.getByPlaceholder('Limit').fill('5');
    await page.getByRole('button', { name: 'Update Line' }).click();

    await expect(page.getByText('0 / 5')).toBeVisible();
  });

  test('deleting a connection via its context menu removes the edge', async ({ page }) => {
    await addTwoSeparatedMachines(page);
    await connectSockets(page, 'Output: Iron Ingot (item)', 'Input: Iron Ore (item)', {
      sourceIndex: 0,
      targetIndex: 1,
    });

    await page.locator('svg > g').first().click({ button: 'right', force: true });
    await page.getByRole('button', { name: 'Delete Connection' }).click();

    await expect(page.locator('svg > g')).toHaveCount(0);
  });
});
