import { test, expect } from './support/fixtures';

test.describe('App shell', () => {
  test('loads with an empty canvas and default library', async ({ page }) => {
    await expect(page).toHaveTitle('MineFlow - Minecraft Process Diagrams');
    await expect(page.getByRole('heading', { name: 'MineFlow' })).toBeVisible();

    for (const name of ['Import', 'Export', 'Dictionary', 'Browse GTNH', 'Add Machine']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }

    await expect(page.getByRole('button', { name: 'Machine Stats 0' })).toBeVisible();
    await expect(page.getByText('Generic Machine')).toBeVisible();
    await expect(page.getByText('Drag items to canvas to add')).toBeVisible();

    // Undo/Redo start disabled with no history yet.
    await expect(page.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Redo (Ctrl+Y)' })).toBeDisabled();
  });
});
