import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { loadSettings, nextCustomReminderAt } from "../reminders/schedule";
import type { CustomReminder } from "../reminders/schedule";
import { positionMenuNearPet, showSettingsWindow } from "../shared/windows";

const menuWindow = getCurrentWindow();

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function nextLabel(reminder: CustomReminder): string {
  const next = nextCustomReminderAt(reminder);
  if (!next) return "已结束";
  const delta = Math.max(0, next.getTime() - Date.now());
  const days = Math.floor(delta / 86_400_000);
  const hours = Math.floor(delta % 86_400_000 / 3_600_000);
  const minutes = Math.ceil(delta % 3_600_000 / 60_000);
  const relative = days ? `${days}天 ${hours}小时后` : hours ? `${hours}小时 ${minutes}分钟后` : `${minutes}分钟后`;
  return `${relative} · ${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
}

export function startMenu(root: HTMLElement): void {
  let expanded = false;
  let closing = false;

  async function close(): Promise<void> {
    if (closing) return;
    closing = true;
    await menuWindow.hide();
    await emit("menu-closed");
    closing = false;
  }

  async function expand(value: boolean): Promise<void> {
    if (expanded === value) return;
    expanded = value;
    const width = value ? 420 : 188;
    await menuWindow.setSize(new LogicalSize(width, 330));
    await positionMenuNearPet(width);
    render();
  }

  function render(): void {
    const settings = loadSettings();
    root.innerHTML = `<main class="menu-layout ${expanded ? "expanded" : ""}">
      <nav class="menu-panel" aria-label="桌宠菜单">
        <button data-action="default">默认提醒</button>
        <button data-action="custom" aria-expanded="${expanded}">自定义提醒 <span>›</span></button>
        <button data-action="focus" aria-pressed="${settings.focusMode}">${settings.focusMode ? "退出专注模式" : "专注模式"}</button>
        <button data-action="hide">隐藏桌宠</button>
      </nav>
      ${expanded ? `<aside class="menu-subpanel" aria-label="自定义提醒列表">
        <button class="menu-add" data-action="add">＋ 添加提醒</button>
        <div class="menu-custom-list">${settings.customReminders.length ? settings.customReminders.map((reminder) => `
          <button class="menu-custom-item ${reminder.enabled ? "" : "is-paused"}" data-action="edit" data-id="${escapeHTML(reminder.id)}">
            <span class="menu-custom-title">${escapeHTML(reminder.title)}</span>
            <small>${reminder.enabled ? nextLabel(reminder) : `已暂停 · ${nextLabel(reminder)}`}</small>
          </button>`).join("") : '<p class="menu-empty">还没有自定义提醒</p>'}</div>
      </aside>` : ""}
    </main>`;
  }

  root.addEventListener("pointerover", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]")?.dataset.action;
    if (action === "custom") void expand(true);
    else if (["default", "focus", "hide"].includes(action ?? "")) void expand(false);
  });
  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) { void close(); return; }
    const action = button.dataset.action;
    if (action === "custom") { void expand(true); return; }
    void (async () => {
      await close();
      if (action === "default") await showSettingsWindow("default");
      if (action === "add") await showSettingsWindow("custom");
      if (action === "edit") await showSettingsWindow("custom", button.dataset.id);
      if (action === "focus") await emit("tray-toggle-focus");
      if (action === "hide") await emit("menu-hide-pet");
    })();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); void close(); }
  });
  void menuWindow.onFocusChanged(({ payload }) => { if (!payload) void close(); });
  void listen("menu-refresh", () => { expanded = false; render(); });
  void listen("settings-changed", render);
  render();
}
