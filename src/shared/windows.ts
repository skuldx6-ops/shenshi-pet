import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, availableMonitors } from "@tauri-apps/api/window";

export async function showSettingsWindow(): Promise<void> {
  const settings = await WebviewWindow.getByLabel("settings");
  if (!settings) return;
  await settings.show();
  await settings.setFocus();
}

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

  const edge = 12 * (await pet.scaleFactor());
  let x = petPosition.x + petSize.width + edge;
  let y = petPosition.y + Math.round((petSize.height - bubbleSize.height) / 2);
  if (screen) {
    const minX = screen.position.x + edge;
    const maxX = screen.position.x + screen.size.width - bubbleSize.width - edge;
    if (x > maxX) x = petPosition.x - bubbleSize.width - edge;
    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(
      screen.position.y + edge,
      Math.min(y, screen.position.y + screen.size.height - bubbleSize.height - edge),
    );
  }
  await bubble.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
}
