import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, availableMonitors } from "@tauri-apps/api/window";

const PLACEMENT_KEY = "shenshi-pet-bubble-placement";

export async function showSettingsWindow(): Promise<void> {
  const settings = await WebviewWindow.getByLabel("settings");
  if (!settings) return;
  await settings.show();
  await settings.setFocus();
}

/** Keep the text bubble centered above the character, falling below near a screen edge. */
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

  const edge = Math.round(8 * (await pet.scaleFactor()));
  let x = Math.round(petPosition.x + (petSize.width - bubbleSize.width) / 2);
  let y = petPosition.y - bubbleSize.height + edge;
  let placement: "above" | "below" = "above";
  if (screen) {
    const minX = screen.position.x + edge;
    const maxX = screen.position.x + screen.size.width - bubbleSize.width - edge;
    x = Math.max(minX, Math.min(x, maxX));
    if (y < screen.position.y + edge) {
      placement = "below";
      y = petPosition.y + petSize.height - edge;
    }
    const minY = screen.position.y + edge;
    const maxY = screen.position.y + screen.size.height - bubbleSize.height - edge;
    y = Math.max(minY, Math.min(y, maxY));
  }
  localStorage.setItem(PLACEMENT_KEY, placement);
  await bubble.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  await emit("bubble-placement", placement);
}
