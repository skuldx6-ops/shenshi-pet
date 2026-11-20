export type ReminderKind = "eye" | "drink" | "lunch" | "checkin" | "custom";
export type RepeatRule = "once" | "daily" | "weekly" | "monthly";

export interface CustomReminder {
  id: string;
  title: string;
  hour: number;
  minute: number;
  repeat: RepeatRule;
  date?: string;
  weekdays?: number[]; // 0 = Sunday
  dayOfMonth?: number;
  advanceMinutes: number[];
  enabled: boolean;
}

export interface ReminderEvent {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  at: number;
  expiresAt?: number;
}

export interface AppSettings {
  version: 1;
  focusMode: boolean;
  eyeEnabled: boolean;
  eyeMinutes: number;
  drinkEnabled: boolean;
  drinkMinutes: number;
  lunchEnabled: boolean;
  checkinEnabled: boolean;
  customReminders: CustomReminder[];
  nextEyeAt: number;
  nextDrinkAt: number;
  fired: Record<string, number>;
  petPosition?: { x: number; y: number };
}

export const STORAGE_KEY = "shenshi-pet-settings-v1";
const catchUpMs = 15 * 60_000;

export function defaultSettings(now = new Date()): AppSettings {
  return {
    version: 1,
    focusMode: false,
    eyeEnabled: true,
    eyeMinutes: 40,
    drinkEnabled: true,
    drinkMinutes: 60,
    lunchEnabled: true,
    checkinEnabled: true,
    customReminders: [],
    nextEyeAt: now.getTime() + 40 * 60_000,
    nextDrinkAt: now.getTime() + 60 * 60_000,
    fired: {},
  };
}

export function loadSettings(now = new Date()): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved?.version !== 1) return defaultSettings(now);
    const base = defaultSettings(now);
    return {
      ...base,
      ...saved,
      customReminders: Array.isArray(saved.customReminders) ? saved.customReminders : [],
      fired: saved.fired && typeof saved.fired === "object" ? saved.fired : {},
    };
  } catch {
    return defaultSettings(now);
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function updateFocus(settings: AppSettings, focusMode: boolean, now = new Date()): AppSettings {
  if (settings.focusMode === focusMode) return settings;
  const updated = { ...settings, focusMode };
  if (!focusMode) {
    updated.nextEyeAt = now.getTime() + updated.eyeMinutes * 60_000;
    updated.nextDrinkAt = now.getTime() + updated.drinkMinutes * 60_000;
  }
  return updated;
}

function dayKey(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function matchesDate(reminder: CustomReminder, day: Date): boolean {
  switch (reminder.repeat) {
    case "once":
      return reminder.date === dayKey(day);
    case "daily":
      return true;
    case "weekly":
      return (reminder.weekdays ?? []).includes(day.getDay());
    case "monthly": {
      const last = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
      return day.getDate() === Math.min(Math.max(reminder.dayOfMonth ?? 1, 1), last);
    }
  }
}

/** Next scheduled occurrence of a custom item in the user's local time zone. */
export function nextCustomReminderAt(reminder: CustomReminder, now = new Date()): Date | null {
  const current = now.getTime();
  const advances = reminder.advanceMinutes.length ? reminder.advanceMinutes : [0];
  let earliest = Infinity;
  const consider = (target: number): void => {
    for (const advance of advances) {
      const at = target - advance * 60_000;
      if (at >= current && at < earliest) earliest = at;
    }
  };
  if (reminder.repeat === "once") {
    if (!reminder.date) return null;
    const [year, month, date] = reminder.date.split("-").map(Number);
    const target = new Date(year, month - 1, date, reminder.hour, reminder.minute);
    if (Number.isFinite(target.getTime())) consider(target.getTime());
    return Number.isFinite(earliest) ? new Date(earliest) : null;
  }
  for (let offset = 0; offset <= 373; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!matchesDate(reminder, day)) continue;
    const target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), reminder.hour, reminder.minute);
    consider(target.getTime());
  }
  return Number.isFinite(earliest) ? new Date(earliest) : null;
}

function dueWithin(now: number, at: number, windowMs = catchUpMs): boolean {
  return now >= at && now - at < windowMs;
}

function fixedDaily(
  now: Date,
  hour: number,
  minute: number,
  id: string,
  kind: ReminderKind,
  title: string,
  body: string,
  fired: Record<string, number>,
  due: ReminderEvent[],
  windowMs = catchUpMs,
): void {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).getTime();
  const key = `${id}:${dayKey(now)}`;
  if (dueWithin(now.getTime(), at, windowMs) && !fired[key]) {
    due.push({ id: key, kind, title, body, at });
    fired[key] = now.getTime();
  }
}

/** Calculates reminders against wall-clock time, so sleep/wake never creates a burst of old popups. */
export function collectDue(settings: AppSettings, now = new Date()): {
  settings: AppSettings;
  due: ReminderEvent[];
} {
  const current = now.getTime();
  const next: AppSettings = { ...settings, fired: { ...settings.fired } };
  const due: ReminderEvent[] = [];

  if (!next.focusMode) {
    if (next.eyeEnabled && current >= next.nextEyeAt) {
      if (dueWithin(current, next.nextEyeAt)) {
        due.push({ id: `eye:${next.nextEyeAt}`, kind: "eye", title: "护眼休息", body: "给瞳孔放个短假，让世界重回清晰。", at: next.nextEyeAt });
      }
      next.nextEyeAt = current + Math.max(next.eyeMinutes, 1) * 60_000;
    }
    if (next.drinkEnabled && current >= next.nextDrinkAt) {
      if (dueWithin(current, next.nextDrinkAt)) {
        due.push({ id: `drink:${next.nextDrinkAt}`, kind: "drink", title: "H₂O Time", body: "吨吨吨！干杯！", at: next.nextDrinkAt });
      }
      next.nextDrinkAt = current + Math.max(next.drinkMinutes, 1) * 60_000;
    }
    if (next.lunchEnabled) {
      fixedDaily(now, 11, 30, "lunch", "lunch", "午饭时间到啦", "需求可以再改，干饭不能迟到。", next.fired, due, 60 * 60_000);
    }
    if (next.checkinEnabled) {
      fixedDaily(now, 9, 0, "checkin-am", "checkin", "叮～打卡", "打卡，是对贫穷最起码的尊重。", next.fired, due);
      fixedDaily(now, 18, 0, "checkin-pm", "checkin", "叮～打卡", "打卡，是对贫穷最起码的尊重。", next.fired, due);
    }
    for (const reminder of next.customReminders) {
      if (!reminder.enabled || !reminder.title.trim()) continue;
      // A one-week advance notice can refer to a target up to seven days ahead.
      for (let offset = 0; offset <= 7; offset += 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        if (!matchesDate(reminder, day)) continue;
        const target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), reminder.hour, reminder.minute).getTime();
        for (const advance of reminder.advanceMinutes.length ? reminder.advanceMinutes : [0]) {
          const at = target - advance * 60_000;
          const key = `custom:${reminder.id}:${dayKey(day)}:${advance}`;
          if (dueWithin(current, at) && !next.fired[key]) {
            due.push({
              id: key,
              kind: "custom",
              title: reminder.title,
              body: advance ? `还有 ${advance < 60 ? `${advance} 分钟` : `${Math.round(advance / 60)} 小时`}开始` : "你设置的提醒时间到了。",
              at,
            });
            next.fired[key] = current;
          }
        }
      }
    }
  }

  for (const [key, firedAt] of Object.entries(next.fired)) {
    if (current - firedAt > 35 * 24 * 60 * 60_000) delete next.fired[key];
  }
  due.sort((a, b) => a.at - b.at);
  return { settings: next, due };
}
