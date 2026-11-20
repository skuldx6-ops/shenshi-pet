import "./styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { startPet } from "./pet/pet";
import { startBubble } from "./reminders/bubble";
import { startSettings } from "./settings/settings";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app mount point");
document.body.dataset.window = getCurrentWindow().label;

switch (getCurrentWindow().label) {
  case "pet":
    startPet(app);
    break;
  case "bubble":
    startBubble(app);
    break;
  case "settings":
    startSettings(app);
    break;
  default:
    app.textContent = "未知窗口";
}
