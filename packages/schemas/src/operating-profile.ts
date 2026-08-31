export const OPERATING_PROFILES = ["catalogue", "observe", "fabric"] as const;
export type OperatingProfile = (typeof OPERATING_PROFILES)[number];

export function parseOperatingProfile(value?: string): OperatingProfile {
  if (value === undefined) return "catalogue";
  if ((OPERATING_PROFILES as readonly string[]).includes(value)) {
    return value as OperatingProfile;
  }
  throw new Error("operating profile must be exactly catalogue, observe, or fabric");
}
