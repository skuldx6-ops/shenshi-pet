import type { ReminderKind } from "./schedule";

/** How long each visible reminder stays on screen. */
export const reminderDurationMs: Record<ReminderKind, number> = {
  eye: 20_000,
  drink: 20_000,
  lunch: 30 * 60_000,
  checkin: 45_000,
  custom: 45_000,
};

export function remainingSeconds(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}
