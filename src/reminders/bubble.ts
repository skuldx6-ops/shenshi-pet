import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReminderEvent, ReminderKind } from "./schedule";
import eye from "../assets/animations/eye.webp";
import drink from "../assets/animations/drink.webp";
import lunch from "../assets/animations/lunch.webp";
import daka from "../assets/animations/daka.webp";
import custom from "../assets/animations/custom.webp";

const images: Record<ReminderKind, string> = {
  eye, drink, lunch, checkin: daka, custom,
};
const ACTIVE_KEY = "shenshi-pet-active-reminder";

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

export function startBubble(root: HTMLElement): void {
  const bubble = getCurrentWindow();

  function render(reminder: ReminderEvent | null): void {
    if (!reminder) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `
      <section class="reminder-card" role="alert">
        <img class="reminder-image" src="${images[reminder.kind]}" alt="" />
        <div class="reminder-copy">
          <strong>${escapeHTML(reminder.title)}</strong>
          <p>${escapeHTML(reminder.body)}</p>
        </div>
        <button class="bubble-close" aria-label="关闭提醒" title="关闭提醒">×</button>
      </section>`;
    root.querySelector(".bubble-close")?.addEventListener("click", () => void close());
  }

  async function close(): Promise<void> {
    await bubble.hide();
    await emit("reminder-closed");
  }

  const saved = localStorage.getItem(ACTIVE_KEY);
  if (saved) {
    try { render(JSON.parse(saved) as ReminderEvent); } catch { /* ignore stale content */ }
  }
  void listen<ReminderEvent>("reminder-show", ({ payload }) => render(payload));
}
