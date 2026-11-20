import test from "node:test";
import assert from "node:assert/strict";
import { collectDue, defaultSettings, updateFocus } from "../src/reminders/schedule.ts";

function at(year, month, date, hour, minute) {
  return new Date(year, month - 1, date, hour, minute);
}

test("lunch appears at 11:30 once per local day, without food suggestions", () => {
  const settings = defaultSettings(at(2026, 11, 20, 8, 0));
  const first = collectDue(settings, at(2026, 11, 20, 11, 30));
  assert.deepEqual(first.due.map((event) => event.kind), ["lunch"]);
  assert.equal(first.due[0].title, "午饭时间到啦");
  const second = collectDue(first.settings, at(2026, 11, 20, 11, 31));
  assert.equal(second.due.length, 0);
  const tomorrow = collectDue(second.settings, at(2026, 11, 21, 11, 30));
  assert.equal(tomorrow.due.filter((event) => event.kind === "lunch").length, 1);
});

test("check-in keeps the original headline at both daily times", () => {
  const settings = defaultSettings(at(2026, 11, 20, 8, 0));
  const morning = collectDue(settings, at(2026, 11, 20, 9, 0));
  assert.equal(morning.due.find((event) => event.kind === "checkin")?.title, "叮～打卡");
  const evening = collectDue(morning.settings, at(2026, 11, 20, 18, 0));
  assert.equal(evening.due.find((event) => event.kind === "checkin")?.title, "叮～打卡");
});

test("focus suppresses routine reminders and restarts intervals on exit", () => {
  const start = at(2026, 11, 20, 8, 0);
  const settings = updateFocus(defaultSettings(start), true, start);
  assert.equal(collectDue(settings, at(2026, 11, 20, 11, 30)).due.length, 0);
  const resumed = updateFocus(settings, false, at(2026, 11, 20, 12, 0));
  assert.equal(resumed.nextEyeAt, at(2026, 11, 20, 12, 40).getTime());
  assert.equal(resumed.nextDrinkAt, at(2026, 11, 20, 13, 0).getTime());
});

test("sleeping through interval reminders skips stale popups", () => {
  const settings = defaultSettings(at(2026, 11, 20, 8, 0));
  const result = collectDue(settings, at(2026, 11, 20, 10, 0));
  assert.equal(result.due.filter((event) => event.kind === "eye" || event.kind === "drink").length, 0);
  assert.equal(result.settings.nextEyeAt, at(2026, 11, 20, 10, 40).getTime());
});

test("monthly custom reminder clamps day 31 to a short month's last day", () => {
  const now = at(2027, 2, 28, 10, 0);
  const settings = defaultSettings(now);
  settings.customReminders = [{
    id: "monthly",
    title: "月底回顾",
    hour: 10,
    minute: 0,
    repeat: "monthly",
    dayOfMonth: 31,
    advanceMinutes: [0],
    enabled: true,
  }];
  assert.equal(collectDue(settings, now).due.filter((event) => event.kind === "custom").length, 1);
});

test("one-week advance notice fires on the correct day", () => {
  const now = at(2026, 11, 20, 9, 0);
  const target = at(2026, 11, 27, 9, 0);
  const settings = defaultSettings(now);
  settings.customReminders = [{
    id: "once",
    title: "重要事项",
    hour: 9,
    minute: 0,
    repeat: "once",
    date: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`,
    advanceMinutes: [10080],
    enabled: true,
  }];
  assert.equal(collectDue(settings, now).due.filter((event) => event.kind === "custom").length, 1);
});
