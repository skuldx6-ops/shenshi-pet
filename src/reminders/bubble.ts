import { emit, listen } from "@tauri-apps/api/event";
import type { ReminderEvent } from "./schedule";
import { reminderHeader } from "./header";

const ACTIVE_KEY = "shenshi-pet-active-reminder";

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

export function startBubble(root: HTMLElement): void {
  function render(reminders: ReminderEvent[]): void {
    root.innerHTML = `<div class="reminder-stack" role="group" aria-label="申时提醒">
      ${reminders.map((reminder) => `
        <section class="reminder-card" role="alert">
          <div class="reminder-copy">
            <span class="reminder-eyebrow">${escapeHTML(reminderHeader(reminder.kind))}</span>
            <strong>${escapeHTML(reminder.title)}</strong>
          </div>
          <button class="bubble-close" data-id="${escapeHTML(reminder.id)}" aria-label="关闭${escapeHTML(reminder.title)}" title="关闭提醒">×</button>
        </section>`).join("")}
    </div>`;
  }

  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".bubble-close");
    if (button?.dataset.id) void emit("reminder-closed", button.dataset.id);
  });

  const saved = localStorage.getItem(ACTIVE_KEY);
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved);
      render(Array.isArray(parsed) ? parsed as ReminderEvent[] : []);
    } catch { render([]); }
  } else render([]);
  void listen<ReminderEvent[]>("reminders-show", ({ payload }) => render(payload));
}
