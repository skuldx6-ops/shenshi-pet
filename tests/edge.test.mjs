import test from "node:test";
import assert from "node:assert/strict";
import { closestEdge, peekX, revealX } from "../src/pet/edge.ts";

test("pet peeks about halfway from the closest screen edge and can fully return", () => {
  const screen = { x: 100, y: 0, width: 1200, height: 800 };
  const left = { x: 280, y: 200, width: 168, height: 180 };
  assert.equal(closestEdge(left, screen), "left");
  assert.equal(peekX(left, screen), 8);
  assert.equal(revealX(left, screen, "left"), 108);
  const right = { ...left, x: 1000 };
  assert.equal(closestEdge(right, screen), "right");
  assert.equal(peekX(right, screen), 1224);
  assert.equal(revealX(right, screen, "right"), 1124);
});
