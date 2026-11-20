import { emit, listen } from "@tauri-apps/api/event";
import type { ReminderEvent, ReminderKind } from "./schedule";

const ACTIVE_KEY = "shenshi-pet-active-reminder";

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

/** Match the original app's orange header copy while keeping this bubble text only. */
function header(kind: ReminderKind, now = new Date()): string {
  if (kind === "eye") return "请注视 6 米外物体";
  const date = `${now.getMonth() + 1}月${now.getDate()}日`;
  switch (kind) {
    case "drink":
    case "custom": return `${date} 温馨提示`;
    case "lunch": return `${date} 今天宜吃`;
    case "checkin": return `${date} 温馨提醒`;
  }
}

export function startBubble(root: HTMLElement): void {
  function render(reminders: ReminderEvent[]): void {
    root.innerHTML = `<div class="reminder-stack" role="group" aria-label="申时提醒">
      ${reminders.map((reminder) => `
        <section class="reminder-card" role="alert">
          <div class="reminder-copy">
            <span class="reminder-eyebrow">${escapeHTML(header(reminder.kind))}</span>
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
