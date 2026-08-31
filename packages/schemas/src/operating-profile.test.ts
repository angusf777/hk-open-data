import { describe, expect, it } from "vitest";

import { parseOperatingProfile } from "./operating-profile.js";

describe("operating profile contract", () => {
  it("defaults to the fail-closed catalogue profile", () => {
    expect(parseOperatingProfile()).toBe("catalogue");
  });

  it.each(["catalogue", "observe", "fabric"] as const)("accepts %s exactly", (profile) => {
    expect(parseOperatingProfile(profile)).toBe(profile);
  });

  it.each(["", "OBSERVE", "unknown"])("rejects unsafe profile value %j", (profile) => {
    expect(() => parseOperatingProfile(profile)).toThrow("operating profile");
  });
});
