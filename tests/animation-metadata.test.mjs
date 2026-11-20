import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function animationMetadata(path) {
  const buffer = readFileSync(new URL(path, import.meta.url));
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  const result = { width: 0, height: 0, loop: 0, durations: [] };
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const content = offset + 8;
    if (kind === "VP8X") {
      result.width = buffer.readUIntLE(content + 4, 3) + 1;
      result.height = buffer.readUIntLE(content + 7, 3) + 1;
    }
    if (kind === "ANIM") result.loop = buffer.readUInt16LE(content + 4);
    if (kind === "ANMF") result.durations.push(buffer.readUIntLE(content + 12, 3));
    offset = content + length + (length & 1);
  }
  return result;
}

test("material-only eye and drink keep every original frame and timing", () => {
  for (const name of ["eye", "drink"]) {
    const source = animationMetadata(`../src/assets/animations/${name}.webp`);
    const refined = animationMetadata(`../src/assets/animations/material/${name}.webp`);
    assert.deepEqual(refined, source, `${name} must retain its original dimensions, loop count, and frame durations`);
  }
});
