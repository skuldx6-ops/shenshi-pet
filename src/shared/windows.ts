import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize, PhysicalPosition, availableMonitors } from "@tauri-apps/api/window";

export const MAX_VISIBLE_REMINDERS = 3;
const BUBBLE_WIDTH = 326;
const ITEM_HEIGHT = 58;
const STACK_GAP = 6;
const STACK_PADDING = 6;

export function bubbleHeight(count: number): number {
  return STACK_PADDING * 2 + ITEM_HEIGHT * count + STACK_GAP * Math.max(0, count - 1);
}

export async function showSettingsWindow(): Promise<void> {
  const settings = await WebviewWindow.getByLabel("settings");
  if (!settings) return;
  await settings.show();
  await settings.setFocus();
}

export async function resizeBubbleForReminders(count: number): Promise<void> {
  const bubble = await WebviewWindow.getByLabel("bubble");
  if (bubble) await bubble.setSize(new LogicalSize(BUBBLE_WIDTH, bubbleHeight(count)));
}

/** Keep the reminder stack centered close to the character, falling below near a screen edge. */
export async function positionBubbleNearPet(): Promise<void> {
  const pet = await WebviewWindow.getByLabel("pet");
  const bubble = await WebviewWindow.getByLabel("bubble");
  if (!pet || !bubble) return;

  const [petPosition, petSize, bubbleSize, monitors] = await Promise.all([
    pet.outerPosition(),
    pet.outerSize(),
    bubble.outerSize(),
    availableMonitors(),
  ]);
  const centerX = petPosition.x + petSize.width / 2;
  const centerY = petPosition.y + petSize.height / 2;
  const screen = monitors.find(({ position, size }) =>
    centerX >= position.x && centerX < position.x + size.width &&
    centerY >= position.y && centerY < position.y + size.height
  ) ?? monitors[0];

  const edge = Math.round(4 * (await pet.scaleFactor()));
  let x = Math.round(petPosition.x + (petSize.width - bubbleSize.width) / 2);
  let y = petPosition.y - bubbleSize.height + edge;
  if (screen) {
    const minX = screen.position.x + edge;
    const maxX = screen.position.x + screen.size.width - bubbleSize.width - edge;
    x = Math.max(minX, Math.min(x, maxX));
    if (y < screen.position.y + edge) {
      y = petPosition.y + petSize.height - edge;
    }
    const minY = screen.position.y + edge;
    const maxY = screen.position.y + screen.size.height - bubbleSize.height - edge;
    y = Math.max(minY, Math.min(y, maxY));
  }
  await bubble.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
}
