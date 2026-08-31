import { describe, expect, it } from "vitest";

import {
  parseMonitorTargets,
  loadMonitorTargets,
  loadSourceGroups,
} from "./registry.js";

describe("normative registry", () => {
  it("loads ten source groups covering fifty sequential monitor targets", () => {
    const groups = loadSourceGroups();
    const targets = loadMonitorTargets();

    expect(groups).toHaveLength(10);
    expect(targets).toHaveLength(50);
    expect(targets.map((target) => target.monitorId)).toEqual(
      Array.from(
        { length: 50 },
        (_, index) => `P14-M${String(index + 1).padStart(3, "0")}`,
      ),
    );

    const knownGroupIds = new Set(groups.map((group) => group.sourceGroupId));
    expect(
      targets
        .filter((target) => target.sourceGroupId !== "P14-ONLY-01")
        .every((target) => knownGroupIds.has(target.sourceGroupId)),
    ).toBe(true);
  });

  it("rejects monitor rows whose activation status bypasses approval", () => {
    const csv = [
      "monitor_id,source_id,source_group_id,provider,name,method,request_template,request_body_json,cadence_seconds,timeout_ms,freshness_rule,required_checks,public_visibility,activation_status,documentation_url,notes",
      "P14-M001,HKAPI-001,P01-SG-01,Provider,Name,GET,https://example.gov.hk/data,,60,1000,retrieval_only,availability,pending_review,approved,https://example.gov.hk/docs,invalid activation",
    ].join("\n");

    expect(() => parseMonitorTargets(csv)).toThrowError(
      /activation_status.*specified_pending_approval/i,
    );
  });

  it("rejects POST monitor rows with malformed request JSON", () => {
    const csv = [
      "monitor_id,source_id,source_group_id,provider,name,method,request_template,request_body_json,cadence_seconds,timeout_ms,freshness_rule,required_checks,public_visibility,activation_status,documentation_url,notes",
      'P14-M001,HKAPI-001,P01-SG-01,Provider,Name,POST,https://example.gov.hk/data,"{broken",60,1000,retrieval_only,availability,pending_review,specified_pending_approval,https://example.gov.hk/docs,invalid JSON',
    ].join("\n");

    expect(() => parseMonitorTargets(csv)).toThrowError(/request_body_json.*valid JSON/i);
  });
});
