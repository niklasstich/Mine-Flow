import { test as base, expect, Page } from '@playwright/test';

// Every test gets a Mine-Flow instance with no prior localStorage state
// (nodes/edges/frames/library/blueprints all start empty/default), so tests
// never see leftover state from a previous test or a real user's session.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await use(page);
  },
});

export { expect };

// The canvas root is the only element with tabIndex=0 in the app, so it's a
// stable, class-name-independent way to find its on-screen origin (needed to
// translate canvas-space coordinates, e.g. for right-click context menus).
export async function getCanvasOrigin(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[tabindex="0"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
}

// New nodes spawn within ~20px of each other, so their sockets (offset
// -30px outside the node's own body) routinely sit underneath a neighboring
// node until the nodes are pulled apart. Drag by a node's header text to
// separate them before doing socket-level interactions.
export async function dragNodeBy(page: Page, headerText: string, dx: number, dy: number) {
  const header = page.getByText(headerText, { exact: true }).first();
  const box = await header.boundingBox();
  if (!box) throw new Error(`Could not locate node header "${headerText}"`);
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 5 + dx / 2, box.y + 5 + dy / 2, { steps: 5 });
  await page.mouse.move(box.x + 5 + dx, box.y + 5 + dy, { steps: 10 });
  await page.mouse.up();
}

// The canvas' custom connection drag (mousedown+mousemove+mouseup on sockets)
// also supports a click-then-click mode: a plain click on a socket (no drag)
// arms a "pending connection", and clicking a second, compatible socket
// completes it. That's far more reliable to script than a real drag.
export async function connectSockets(
  page: Page,
  sourceTitle: string,
  targetTitle: string,
  { sourceIndex = 0, targetIndex = 0 }: { sourceIndex?: number; targetIndex?: number } = {}
) {
  const source = page.getByTitle(sourceTitle).nth(sourceIndex);
  const target = page.getByTitle(targetTitle).nth(targetIndex);
  await source.click();
  await target.click();
}

// Sidebar library items use native HTML5 drag-and-drop (DataTransfer), which
// Playwright's mouse-based drag emulation cannot trigger. Dispatch the
// dragstart/dragover/drop sequence directly instead.
export async function dragLibraryItemToCanvas(page: Page, itemText: string, drop: { x: number; y: number }) {
  const item = page.locator(`div[draggable="true"]:has-text("${itemText}")`).first();
  await item.evaluate(
    (el, { dropX, dropY }) => {
      const dataTransfer = new DataTransfer();
      el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));

      const canvasEl = document.elementFromPoint(dropX, dropY);
      if (!canvasEl) throw new Error('No element at drop point');
      canvasEl.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientX: dropX, clientY: dropY })
      );
      canvasEl.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX: dropX, clientY: dropY })
      );
    },
    { dropX: drop.x, dropY: drop.y }
  );
}
