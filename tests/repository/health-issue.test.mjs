import assert from "node:assert/strict";
import test from "node:test";

import { renderHealthIssue } from "../../scripts/render_health_issue.mjs";

test("health issue is deterministic, deduplicated, and does not imply source deletion", () => {
  const report = {
    generatedAt: "2026-08-31T00:00:00+00:00",
    summary: { checked: 2, failures: 1, deleted: 0 },
    findings: [
      {
        resource_id: "official:test",
        field: "landing",
        url: "https://example.test/",
        status: "unavailable",
        attempts: 2,
        http_status: 503,
        detail: null,
      },
    ],
    deleted: [],
  };
  const first = renderHealthIssue(report);
  const second = renderHealthIssue(structuredClone(report));
  assert.equal(first, second);
  assert.match(first, /Automated catalogue health report/);
  assert.match(first, /official:test/);
  assert.match(first, /No catalogue records were changed or deleted/);
  assert.match(first, /<!-- hk-open-data-health:[0-9a-f]{64} -->/);
});

test("healthy report produces a closure-ready status without legal conclusions", () => {
  const text = renderHealthIssue({
    generatedAt: "2026-08-31T00:00:00+00:00",
    summary: { checked: 1, failures: 0, deleted: 0 },
    findings: [],
    deleted: [],
  });
  assert.match(text, /No current link or staleness findings/);
  assert.doesNotMatch(text, /permitted|legally cleared|approved for use/i);
});
