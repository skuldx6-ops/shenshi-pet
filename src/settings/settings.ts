import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadSettings, saveSettings } from "../reminders/schedule";
import type { AppSettings, CustomReminder, ReminderKind, RepeatRule } from "../reminders/schedule";

const advances = [
  { value: 0, label: "到点" },
  { value: 5, label: "提前 5 分钟" },
  { value: 10, label: "提前 10 分钟" },
  { value: 15, label: "提前 15 分钟" },
  { value: 30, label: "提前 30 分钟" },
  { value: 1440, label: "提前 1 天" },
  { value: 2880, label: "提前 2 天" },
  { value: 10080, label: "提前 1 周" },
];
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function repeatLabel(reminder: CustomReminder): string {
  switch (reminder.repeat) {
    case "once": return reminder.date ?? "单次";
    case "daily": return "每天";
    case "weekly": return `每周${(reminder.weekdays ?? []).map((day) => weekdays[day]).join("、")}`;
    case "monthly": return `每月 ${reminder.dayOfMonth ?? 1} 日`;
  }
}

export function startSettings(root: HTMLElement): void {
  const window = getCurrentWindow();
  const isCustom = window.label === "custom-settings";
  let settings = loadSettings();
  let editingId: string | null = null;

  function persist(): void {
    saveSettings(settings);
    void emit("settings-changed");
  }

  function render(): void {
    const editing = settings.customReminders.find((reminder) => reminder.id === editingId);
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    root.innerHTML = `
      <main class="settings-page">
        <section id="default-reminders" class="setting-card" ${isCustom ? "hidden" : ""}>
          <div class="setting-row">
            <div><strong>护眼提醒</strong><small>每隔一段时间，让眼睛休息</small></div>
            <div class="setting-controls"><input class="minutes" type="number" min="1" max="240" data-setting="eyeMinutes" value="${settings.eyeMinutes}" /><span>分钟</span><label class="switch"><input type="checkbox" data-setting="eyeEnabled" ${settings.eyeEnabled ? "checked" : ""} /><span></span></label></div>
          </div>
          <div class="setting-row">
            <div><strong>饮水提醒</strong><small>每隔一段时间，喝点水</small></div>
            <div class="setting-controls"><input class="minutes" type="number" min="1" max="240" data-setting="drinkMinutes" value="${settings.drinkMinutes}" /><span>分钟</span><label class="switch"><input type="checkbox" data-setting="drinkEnabled" ${settings.drinkEnabled ? "checked" : ""} /><span></span></label></div>
          </div>
          <div class="setting-row">
            <div><strong>午饭提醒</strong><small>每天 11:30 固定弹出，无随机选餐</small></div>
            <label class="switch"><input type="checkbox" data-setting="lunchEnabled" ${settings.lunchEnabled ? "checked" : ""} /><span></span></label>
          </div>
          <div class="setting-row">
            <div><strong>打卡提醒</strong><small>每天 09:00 和 18:00</small></div>
            <label class="switch"><input type="checkbox" data-setting="checkinEnabled" ${settings.checkinEnabled ? "checked" : ""} /><span></span></label>
          </div>
          <div class="preview-row">
            <span>查看效果</span>
            ${(["eye", "drink", "lunch", "checkin"] as ReminderKind[]).map((kind) =>
              `<button class="chip" data-preview="${kind}">${{ eye: "护眼", drink: "饮水", lunch: "午饭", checkin: "打卡", custom: "自定义" }[kind]}</button>`
            ).join("")}
          </div>
        </section>
        <section id="custom-reminders" class="setting-card" ${isCustom ? "" : "hidden"}>
          <div class="section-title"><div><p>支持单次、每天、每周、每月，以及提前提醒。</p></div><span>${settings.customReminders.length} / 10</span></div>
          <div class="custom-list">
            ${settings.customReminders.length ? settings.customReminders.map((reminder) => `
              <article class="custom-item">
                <div><strong>${escapeHTML(reminder.title)}</strong><small>${repeatLabel(reminder)} · ${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}</small></div>
                <button data-action="edit" data-id="${reminder.id}">编辑</button>
                <button class="${reminder.enabled ? "pause-action" : "enable-action"}" data-action="toggle" data-id="${reminder.id}">${reminder.enabled ? "暂停" : "启用"}</button>
                <button class="danger" data-action="delete" data-id="${reminder.id}">删除</button>
              </article>`).join("") : '<p class="empty-state">还没有自定义提醒</p>'}
          </div>
          <form id="custom-form" class="custom-form">
            <h3>${editing ? "编辑提醒" : "添加提醒"}</h3>
            <div class="form-grid">
              <label class="field field-wide">提醒内容<input name="title" maxlength="30" required placeholder="例如：开会、吃药、休息" value="${escapeHTML(editing?.title ?? "")}" /></label>
              <label class="field">时间<input name="time" type="time" required value="${String(editing?.hour ?? 12).padStart(2, "0")}:${String(editing?.minute ?? 0).padStart(2, "0")}" /></label>
              <label class="field">重复<select name="repeat">
                ${(["once", "daily", "weekly", "monthly"] as RepeatRule[]).map((rule) =>
                  `<option value="${rule}" ${(editing?.repeat ?? "daily") === rule ? "selected" : ""}>${{ once: "单次", daily: "每天", weekly: "每周", monthly: "每月" }[rule]}</option>`
                ).join("")}</select></label>
              <label class="field repeat-once">日期<input name="date" type="date" value="${editing?.date ?? defaultDate}" /></label>
              <label class="field repeat-monthly">每月几日<input name="dayOfMonth" type="number" min="1" max="31" value="${editing?.dayOfMonth ?? 1}" /></label>
              <fieldset class="field-wide repeat-weekly"><legend>星期</legend><div class="checkbox-row">
                ${weekdays.map((day, index) => `<label><input type="checkbox" name="weekday" value="${index}" ${(editing?.weekdays ?? [1, 2, 3, 4, 5]).includes(index) ? "checked" : ""}/>${day}</label>`).join("")}
              </div></fieldset>
              <fieldset class="field-wide"><legend>提醒时机（可多选）</legend><div class="checkbox-row advance-row">
                ${advances.map(({ value, label }) => `<label><input type="checkbox" name="advance" value="${value}" ${(editing?.advanceMinutes ?? [0]).includes(value) ? "checked" : ""}/>${label}</label>`).join("")}
              </div></fieldset>
            </div>
            <div class="form-actions"><button class="primary" type="submit">${editing ? "保存修改" : "添加提醒"}</button>${editing ? '<button type="button" data-action="cancel-edit">取消编辑</button>' : ""}</div>
          </form>
        </section>
      </main>`;

    const form = root.querySelector<HTMLFormElement>("#custom-form")!;
    const repeat = form.elements.namedItem("repeat") as HTMLSelectElement;
    function updateRepeatFields(): void {
      for (const rule of ["once", "weekly", "monthly"]) {
        root.querySelector<HTMLElement>(`.repeat-${rule}`)!.hidden = repeat.value !== rule;
      }
    }
    repeat.addEventListener("change", updateRepeatFields);
    updateRepeatFields();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editingId && settings.customReminders.length >= 10) return;
      const data = new FormData(form);
      const [hour, minute] = String(data.get("time")).split(":").map(Number);
      const reminder: CustomReminder = {
        id: editingId ?? crypto.randomUUID(),
        title: String(data.get("title") ?? "").trim().slice(0, 30),
        hour, minute,
        repeat: String(data.get("repeat")) as RepeatRule,
        date: String(data.get("date") ?? ""),
        dayOfMonth: Number(data.get("dayOfMonth") ?? 1),
        weekdays: data.getAll("weekday").map(Number),
        advanceMinutes: data.getAll("advance").map(Number).sort((a, b) => a - b),
        enabled: editing?.enabled ?? true,
      };
      if (!reminder.title || !Number.isFinite(hour) || !Number.isFinite(minute)) return;
      if (reminder.repeat === "weekly" && !reminder.weekdays?.length) return;
      if (!reminder.advanceMinutes.length) reminder.advanceMinutes = [0];
      if (editingId) settings.customReminders = settings.customReminders.map((item) => item.id === editingId ? reminder : item);
      else settings.customReminders.push(reminder);
      editingId = null;
      persist();
      render();
    });
  }

  root.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const key = input.dataset.setting as keyof AppSettings | undefined;
    if (!key) return;
    if (key === "eyeMinutes" || key === "drinkMinutes") {
      const minutes = Math.max(1, Math.min(240, Number(input.value) || 1));
      if (key === "eyeMinutes") {
        settings.eyeMinutes = minutes;
        settings.nextEyeAt = Date.now() + minutes * 60_000;
      } else {
        settings.drinkMinutes = minutes;
        settings.nextDrinkAt = Date.now() + minutes * 60_000;
      }
      input.value = String(minutes);
    } else if (key === "eyeEnabled" || key === "drinkEnabled" || key === "lunchEnabled" || key === "checkinEnabled") {
      settings[key] = input.checked;
    }
    persist();
  });
  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.preview) {
      void emit("preview-reminder", button.dataset.preview as ReminderKind);
      return;
    }
    const id = button.dataset.id;
    switch (button.dataset.action) {
      case "edit": editingId = id ?? null; render(); break;
      case "cancel-edit": editingId = null; render(); break;
      case "toggle":
        settings.customReminders = settings.customReminders.map((item) =>
          item.id === id ? { ...item, enabled: !item.enabled } : item
        );
        persist(); render(); break;
      case "delete":
        settings.customReminders = settings.customReminders.filter((item) => item.id !== id);
        if (editingId === id) editingId = null;
        persist(); render(); break;
    }
  });
  void window.onCloseRequested((event) => {
    event.preventDefault();
    void window.hide();
  });
  void listen<string>("edit-custom-reminder", ({ payload }) => {
    if (!isCustom) return;
    settings = loadSettings();
    editingId = payload;
    render();
    requestAnimationFrame(() => root.querySelector("#custom-form")?.scrollIntoView({ block: "end" }));
  });
  void listen("settings-changed", () => {
    settings = loadSettings();
    render();
  });
  render();
}
