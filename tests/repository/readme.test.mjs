import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const file of ["README.md", "README.zh-HK.md"]) {
  test(`${file} exposes discovery, local use and safeguards`, async () => {
    const text = await readFile(file, "utf8");
    assert.match(text, /catalog|目錄/i);
    assert.match(text, /docker compose|pnpm/i);
    assert.match(text, /independent|獨立/i);
    assert.match(text, /current terms|現行條款/i);
    assert.match(text, /correction|更正/i);
  });
}

test("README statistics are delimited for deterministic updates", async () => {
  for (const file of ["README.md", "README.zh-HK.md"]) {
    const text = await readFile(file, "utf8");
    assert.equal(text.match(/<!-- catalog-counts:start -->/g)?.length, 1);
    assert.equal(text.match(/<!-- catalog-counts:end -->/g)?.length, 1);
  }
});
