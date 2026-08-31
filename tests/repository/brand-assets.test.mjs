import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function pngDimensions(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("social preview has exact dimensions and no government branding", async () => {
  const png = await readFile("assets/brand/social-preview.png");
  assert.deepEqual(pngDimensions(png), [1280, 640]);
  const svg = await readFile("assets/brand/hk-open-data-mark.svg", "utf8");
  assert.doesNotMatch(svg, /bauhinia|government logo|brandhk|provider logo/i);
  assert.match(svg, /HK OPEN DATA/);
});

test("launch copy uses generated counts and restrained claims", async () => {
  const text = await readFile("docs/launch/LAUNCH_COPY.md", "utf8");
  assert.match(text, /521/);
  assert.match(text, /265/);
  assert.match(text, /145/);
  assert.match(text, /111/);
  assert.match(text, /independent community/i);
  assert.doesNotMatch(text, /largest|complete coverage|legally cleared|guaranteed availability/i);
});
