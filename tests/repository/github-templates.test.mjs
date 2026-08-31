import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { configureRepository } from "../../scripts/configure_github.mjs";

test("resource requests collect provenance without legal conclusions", async () => {
  const text = await readFile(".github/ISSUE_TEMPLATE/resource-request.yml", "utf8");
  assert.match(text, /Official landing URL/);
  assert.match(text, /Terms or licence URL/);
  assert.match(text, /Evidence checked date/);
  assert.doesNotMatch(text, /Is commercial use allowed/);
  assert.match(text, /no credentials or restricted data/i);
});

test("pull request template keeps contribution flow low friction", async () => {
  const text = await readFile(".github/PULL_REQUEST_TEMPLATE.md", "utf8");
  assert.match(text, /bilingual/i);
  assert.match(text, /terms evidence/i);
  assert.match(text, /no provider payloads/i);
  assert.doesNotMatch(text, /CLA|second approver|CODEOWNERS/i);
});

test("repository configuration is idempotent and uses no fictitious teams", async () => {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === "GET" && path.endsWith("/labels?per_page=100")) {
      return [{ name: "catalogue" }];
    }
    return {};
  };
  await configureRepository("angusf777", "hk-open-data", api);
  assert.ok(calls.some((call) => call.method === "PATCH" && call.path.endsWith("/labels/catalogue")));
  assert.ok(calls.some((call) => call.method === "POST" && call.path.endsWith("/labels")));
  assert.ok(calls.some((call) => call.path.endsWith("/topics")));
  assert.doesNotMatch(JSON.stringify(calls), /team|codeowner/i);
});
