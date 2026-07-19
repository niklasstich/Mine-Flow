import { test, expect } from './support/fixtures';
import { dragNodeBy } from './support/fixtures';

test.describe('Node resize and IO display', () => {
  test('dragging the bottom-right handle grows the node and the new size survives reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await dragNodeBy(page, 'Machine 1', 300, 300);

    const nodeBox = page.getByTestId('node-resize-handle').locator('xpath=..');
    const before = await nodeBox.boundingBox();
    if (!before) throw new Error('Could not locate node box');

    await page.mouse.move(before.x + before.width - 2, before.y + before.height - 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width + 120, before.y + before.height + 80, { steps: 10 });
    await page.mouse.up();

    const after = await nodeBox.boundingBox();
    if (!after) throw new Error('Could not locate node box after resize');
    expect(after.width).toBeGreaterThan(before.width + 60);
    expect(after.height).toBeGreaterThan(before.height + 40);

    // Resized dimensions are part of NodeData, so they persist through the
    // same localStorage save/load path as position and recipe.
    await page.reload();
    const persisted = await page.getByTestId('node-resize-handle').locator('xpath=..').boundingBox();
    expect(persisted!.width).toBeGreaterThan(before.width + 60);
  });

  test('IO rows show a colored type badge and reveal full text on hover', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await dragNodeBy(page, 'Machine 1', 300, 300);

    // Default recipe's inputs/outputs are both type "item" -> unitDictionary label "Item".
    await expect(page.getByTitle('Item').first()).toBeVisible();

    const tooltip = page.getByTestId('io-tooltip-in');
    await expect(tooltip).toBeHidden();
    // Hover the type badge, not the (pointer-events-none) label text, since
    // that text is deliberately non-interactive so it doesn't steal the
    // node's own drag handling.
    await page.getByTitle('Item', { exact: true }).first().hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Iron Ore');
    await expect(tooltip).toContainText('(Item)');
  });

  test('shrinking a multi-row node clamps to a minimum that still fits every IO row', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByTitle('Edit Recipe').first().click();

    // Give this node 2 inputs / 1 output, matching the reported repro: an
    // unpaired row that a flat, row-count-agnostic minimum height doesn't
    // leave room for.
    const inputsSection = page.locator('div.space-y-2').filter({ has: page.locator('h3', { hasText: 'Inputs' }) });
    await inputsSection.getByRole('button', { name: 'Add', exact: true }).click();
    await inputsSection.getByPlaceholder('Item Name').nth(1).fill('Circuit');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await dragNodeBy(page, 'Machine 1', 300, 300);

    const nodeBox = page.getByTestId('node-resize-handle').locator('xpath=..');
    const before = await nodeBox.boundingBox();
    if (!before) throw new Error('Could not locate node box');

    // Drag the handle up and to the left of the node entirely -- an extreme
    // shrink attempt, far past any reasonable minimum.
    await page.mouse.move(before.x + before.width - 2, before.y + before.height - 2);
    await page.mouse.down();
    await page.mouse.move(before.x - 500, before.y - 500, { steps: 10 });
    await page.mouse.up();

    const after = await nodeBox.boundingBox();
    if (!after) throw new Error('Could not locate node box after resize');

    // The second input row's socket (the unpaired row with no matching
    // output) must stay fully inside the node's own bottom border, not
    // spill out past it.
    const secondInputSocket = page.getByTitle('Input: Circuit (item)');
    const socketBox = await secondInputSocket.boundingBox();
    if (!socketBox) throw new Error('Could not locate second input socket');

    expect(socketBox.y + socketBox.height).toBeLessThanOrEqual(after.y + after.height + 1);
  });

  // Coverage across a range of shapes: balanced (1-1), one-sided (3-1),
  // partly-paired (3-2), and two "absurd" high-row-count cases (10-10,
  // 10-12) to make sure the per-node minimum keeps scaling correctly and
  // doesn't, say, silently cap out or overflow once rows get numerous.
  const IO_SHAPES = [
    { label: '1 in / 1 out', inputs: 1, outputs: 1 },
    { label: '3 in / 1 out', inputs: 3, outputs: 1 },
    { label: '3 in / 2 out', inputs: 3, outputs: 2 },
    { label: '10 in / 10 out', inputs: 10, outputs: 10 },
    { label: '10 in / 12 out', inputs: 10, outputs: 12 },
  ];

  for (const { label, inputs, outputs } of IO_SHAPES) {
    test(`shrinking a ${label} node keeps every row inside the box`, async ({ page }) => {
      await page.getByRole('button', { name: 'Add Machine' }).click();
      await page.getByTitle('Edit Recipe').first().click();

      const inputsSection = page.locator('div.space-y-2').filter({ has: page.locator('h3', { hasText: 'Inputs' }) });
      const outputsSection = page.locator('div.space-y-2').filter({ has: page.locator('h3', { hasText: 'Outputs' }) });
      const addButton = (section: typeof inputsSection) => section.getByRole('button', { name: 'Add', exact: true });

      for (let i = 1; i < inputs; i++) await addButton(inputsSection).click();
      for (let i = 1; i < outputs; i++) await addButton(outputsSection).click();

      // Uniquely name the last row of whichever side is longest (ties go to
      // inputs) -- that's the row with the least paired-column headroom, so
      // it's the one most likely to spill out if the minimum is wrong.
      const longerIsInputs = inputs >= outputs;
      const targetSection = longerIsInputs ? inputsSection : outputsSection;
      const targetRowCount = Math.max(inputs, outputs);
      await targetSection.getByPlaceholder('Item Name').nth(targetRowCount - 1).fill('Tallest Row');

      await page.getByRole('button', { name: 'Save Changes' }).click();
      await dragNodeBy(page, 'Machine 1', 300, 300);

      const nodeBox = page.getByTestId('node-resize-handle').locator('xpath=..');
      const before = await nodeBox.boundingBox();
      if (!before) throw new Error('Could not locate node box');

      await page.mouse.move(before.x + before.width - 2, before.y + before.height - 2);
      await page.mouse.down();
      await page.mouse.move(before.x - 500, before.y - 500, { steps: 10 });
      await page.mouse.up();

      const after = await nodeBox.boundingBox();
      if (!after) throw new Error('Could not locate node box after resize');

      const socket = page.getByTitle(`${longerIsInputs ? 'Input' : 'Output'}: Tallest Row (item)`);
      const socketBox = await socket.boundingBox();
      if (!socketBox) throw new Error('Could not locate the target row\'s socket');

      expect(socketBox.y + socketBox.height).toBeLessThanOrEqual(after.y + after.height + 1);
      expect(socketBox.y).toBeGreaterThanOrEqual(after.y - 1);
    });
  }

  test('adding IO rows to an already-shrunk node grows it to fit them', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await dragNodeBy(page, 'Machine 1', 300, 300);

    // Shrink the (single-row) node down to its minimum first.
    const nodeBox = page.getByTestId('node-resize-handle').locator('xpath=..');
    const shrunk = await nodeBox.boundingBox();
    if (!shrunk) throw new Error('Could not locate node box');
    await page.mouse.move(shrunk.x + shrunk.width - 2, shrunk.y + shrunk.height - 2);
    await page.mouse.down();
    await page.mouse.move(shrunk.x - 500, shrunk.y - 500, { steps: 10 });
    await page.mouse.up();
    const afterShrink = await nodeBox.boundingBox();
    if (!afterShrink) throw new Error('Could not locate node box after shrink');

    // Now, without touching the resize handle again, add three more input
    // rows via Edit Recipe -- the node still carries the small explicit
    // height from the shrink above, which no longer fits 4 rows.
    await page.getByTitle('Edit Recipe').first().click();
    const inputsSection = page.locator('div.space-y-2').filter({ has: page.locator('h3', { hasText: 'Inputs' }) });
    for (let i = 0; i < 3; i++) {
      await inputsSection.getByRole('button', { name: 'Add', exact: true }).click();
    }
    await inputsSection.getByPlaceholder('Item Name').nth(3).fill('Overflow Check');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    const afterGrow = await nodeBox.boundingBox();
    if (!afterGrow) throw new Error('Could not locate node box after adding rows');

    // The box itself must have grown from its shrunk size...
    expect(afterGrow.height).toBeGreaterThan(afterShrink.height);

    // ...and the new (4th) row's socket must land fully inside it, not
    // spill out past the bottom border the way it did before this fix.
    const socket = page.getByTitle('Input: Overflow Check (item)');
    const socketBox = await socket.boundingBox();
    if (!socketBox) throw new Error('Could not locate the new row\'s socket');
    expect(socketBox.y + socketBox.height).toBeLessThanOrEqual(afterGrow.y + afterGrow.height + 1);
  });
});
