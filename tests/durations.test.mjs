import test from "node:test";
import assert from "node:assert/strict";
import { reminderDurationMs, remainingSeconds } from "../src/reminders/durations.ts";

test("routine alerts close after their intended durations", () => {
  assert.equal(reminderDurationMs.eye, 20_000);
  assert.equal(reminderDurationMs.drink, 20_000);
  assert.equal(reminderDurationMs.lunch, 30 * 60_000);
});

test("eye countdown starts at 20 and reaches zero at expiry", () => {
  const start = 1_000_000;
  const expiry = start + reminderDurationMs.eye;
  assert.equal(remainingSeconds(expiry, start), 20);
  assert.equal(remainingSeconds(expiry, start + 19_100), 1);
  assert.equal(remainingSeconds(expiry, expiry), 0);
});
