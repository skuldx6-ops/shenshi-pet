import type { ReminderKind } from "./schedule";

/** Uses the computer's current local date, matching the original Mac reminder headings. */
export function reminderHeader(kind: ReminderKind, now = new Date()): string {
  if (kind === "eye") return "请注视 6 米外物体";
  const date = `${now.getMonth() + 1}月${now.getDate()}日`;
  switch (kind) {
    case "drink":
    case "custom": return `${date} 温馨提示`;
    case "lunch":
    case "checkin": return `${date} 温馨提醒`;
  }
}
