import { test, expect } from './support/fixtures';

test.describe('Import / Export', () => {
  test('exporting the diagram shows a copyable MF_DIAGRAM code', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByRole('button', { name: 'Export' }).click();

    await expect(page.getByRole('heading', { name: 'Share Diagram' })).toBeVisible();
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveValue(/^MF_DIAGRAM:/);
  });

  test('importing a diagram code replaces the current canvas after confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByRole('button', { name: 'Export' }).click();
    const diagramCode = await page.locator('textarea').inputValue();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Add a second machine so the current canvas clearly differs from the
    // one-machine diagram we're about to import.
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await expect(page.getByRole('button', { name: 'Machine Stats 2' })).toBeVisible();

    await page.getByRole('button', { name: 'Import' }).click();
    await page.locator('textarea').fill(diagramCode);
    await page.getByRole('button', { name: 'Load Data' }).click();

    await expect(page.getByRole('heading', { name: 'Replace Diagram?' })).toBeVisible();
    await page.getByRole('button', { name: 'Import & Replace' }).click();

    await expect(page.getByRole('button', { name: 'Machine Stats 1' })).toBeVisible();
  });

  test('importing garbage text shows an error instead of crashing', async ({ page }) => {
    await page.getByRole('button', { name: 'Import' }).click();
    await page.locator('textarea').fill('not a valid mineflow code');

    // parseImportString falls through to an alert() for unrecognized data;
    // the listener must be registered before the click that triggers it.
    let dialogMessage = '';
    page.once('dialog', (d) => {
      dialogMessage = d.message();
      d.accept();
    });
    await page.getByRole('button', { name: 'Load Data' }).click();

    await expect.poll(() => dialogMessage).toContain('Invalid data string');
  });

  test('sharing a library machine produces an MF_MACHINE code', async ({ page }) => {
    await page.locator('div[draggable="true"]:has-text("Generic Machine")').getByTitle('Share Machine').click();

    await expect(page.getByRole('heading', { name: 'Share Machine' })).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue(/^MF_MACHINE:/);
  });
});
