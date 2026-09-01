import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const required = {
  NOTICE: [
    "Apache License 2.0",
    "does not license",
    "upstream terms always control",
    "independent",
  ],
  "CONTRIBUTING.md": [
    "catalogue metadata",
    "source terms review",
    "credentials",
    "Apache License 2.0",
  ],
  "SECURITY.md": [
    "privately report",
    "GitHub Security Advisory",
    "Do not open a public issue",
  ],
  "docs/governance/CORRECTIONS_AND_TAKEDOWNS.md": [
    "correction",
    "takedown",
    "source URL",
    "acknowledgement",
  ],
};

for (const [file, phrases] of Object.entries(required)) {
  test(`${file} contains mandatory safeguards`, async () => {
    const text = (await readFile(file, "utf8")).toLowerCase();
    for (const phrase of phrases) {
      assert.ok(text.includes(phrase.toLowerCase()), `${file} is missing: ${phrase}`);
    }
  });
}

test("governance names only the actual founding maintainer", async () => {
  const text = await readFile("GOVERNANCE.md", "utf8");
  assert.match(text, /@angusf777/);
  assert.doesNotMatch(text, /data owner|legal owner|security owner/i);
});

test("source-rights guidance uses only approved evidence states", async () => {
  const text = await readFile("docs/governance/SOURCE_RIGHTS.md", "utf8");
  for (const state of [
    "not-reviewed",
    "official-terms-linked",
    "restriction-identified",
    "ambiguity-identified",
    "provider-confirmation-recorded",
  ]) {
    assert.ok(text.includes(`\`${state}\``), `missing evidence state ${state}`);
  }
  assert.doesNotMatch(text, /commercial use allowed|safe to cache|redistribution approved/i);
});
