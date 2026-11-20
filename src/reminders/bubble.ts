import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReminderEvent, ReminderKind } from "./schedule";

const ACTIVE_KEY = "shenshi-pet-active-reminder";
const PLACEMENT_KEY = "shenshi-pet-bubble-placement";
const captions: Record<ReminderKind, string> = {
  eye: "护眼提醒",
  drink: "饮水提醒",
  lunch: "11:30 午饭提醒",
  checkin: "温馨提醒",
  custom: "自定义提醒",
};

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

export function startBubble(root: HTMLElement): void {
  const bubble = getCurrentWindow();
  let current: ReminderEvent | null = null;

  function render(reminder: ReminderEvent | null): void {
    current = reminder;
    if (!reminder) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `
      <section class="reminder-card" role="alert">
        <div class="reminder-copy">
          <span class="reminder-eyebrow">${captions[reminder.kind]}</span>
          <strong>${escapeHTML(reminder.title)}</strong>
          <p>${escapeHTML(reminder.body)}</p>
        </div>
        <button class="bubble-close" aria-label="关闭提醒" title="关闭提醒">×</button>
      </section>`;
    root.querySelector(".bubble-close")?.addEventListener("click", () => void close());
  }

  async function close(): Promise<void> {
    const id = current?.id;
    if (!id) return;
    await bubble.hide();
    render(null);
    await emit("reminder-closed", id);
  }

  document.body.dataset.placement = localStorage.getItem(PLACEMENT_KEY) ?? "above";
  const saved = localStorage.getItem(ACTIVE_KEY);
  if (saved) {
    try { render(JSON.parse(saved) as ReminderEvent); } catch { /* ignore stale content */ }
  }
  void listen<ReminderEvent>("reminder-show", ({ payload }) => render(payload));
  void listen<"above" | "below">("bubble-placement", ({ payload }) => {
    document.body.dataset.placement = payload;
  });
}
