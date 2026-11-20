import test from "node:test";
import assert from "node:assert/strict";
import { reminderHeader } from "../src/reminders/header.ts";

test("reminder headers use today's local date and the requested lunch copy", () => {
  const today = new Date(2026, 10, 20, 11, 30);
  assert.equal(reminderHeader("checkin", today), "11月20日 温馨提醒");
  assert.equal(reminderHeader("lunch", today), "11月20日 温馨提醒");
  assert.equal(reminderHeader("drink", today), "11月20日 温馨提示");
  assert.equal(reminderHeader("eye", today), "请注视 6 米外物体");
});
