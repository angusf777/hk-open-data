import { describe, expect, it } from "vitest";

import type { SourceDefinition } from "./domain.js";
import { MemoryPlatformRepository } from "./memory-repository.js";

const now = "2026-08-28T10:00:00.000Z";

function source(
  sourceId: string,
  approvalStatus: SourceDefinition["approvalStatus"],
  visibility: SourceDefinition["visibility"],
): SourceDefinition {
  return {
    sourceId,
    projects: ["P01"],
    name: `Source ${sourceId}`,
    provider: "Provider",
    authorityClass: "official",
    approvalStatus,
    visibility,
    freshnessStatus: "unknown",
    lastSuccessAt: null,
    documentationUrl: "https://example.gov.hk/docs",
    cadence: "daily",
    approvedUses: [],
    limitations: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe("MemoryPlatformRepository", () => {
  it("never returns pending or private sources to a public query", async () => {
    const repository = new MemoryPlatformRepository({
      sources: [
        source("HKAPI-001", "approved", "public"),
        source("HKAPI-002", "specified_pending_approval", "public"),
        source("HKAPI-003", "approved", "private"),
      ],
    });

    const page = await repository.listSources({ visibility: "public", limit: 50 });

    expect(page.items.map((item) => item.sourceId)).toEqual(["HKAPI-001"]);
  });

  it("uses a stable opaque cursor without repeating rows", async () => {
    const repository = new MemoryPlatformRepository({
      sources: [
        source("HKAPI-001", "approved", "public"),
        source("HKAPI-002", "approved", "public"),
        source("HKAPI-003", "approved", "public"),
      ],
    });

    const first = await repository.listSources({ visibility: "public", limit: 2 });
    const second = await repository.listSources({
      visibility: "public",
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });

    expect(first.items.map((item) => item.sourceId)).toEqual(["HKAPI-001", "HKAPI-002"]);
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second.items.map((item) => item.sourceId)).toEqual(["HKAPI-003"]);
    expect(second.nextCursor).toBeNull();
  });

  it("keeps pagination stable when a row is inserted before the cursor", async () => {
    const initial = new MemoryPlatformRepository({
      sources: [
        source("HKAPI-002", "approved", "public"),
        source("HKAPI-003", "approved", "public"),
      ],
    });
    const first = await initial.listSources({ visibility: "public", limit: 1 });

    const afterConcurrentInsert = new MemoryPlatformRepository({
      sources: [
        source("HKAPI-001", "approved", "public"),
        source("HKAPI-002", "approved", "public"),
        source("HKAPI-003", "approved", "public"),
      ],
    });
    const second = await afterConcurrentInsert.listSources({
      visibility: "public",
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });

    expect(first.items.map((item) => item.sourceId)).toEqual(["HKAPI-002"]);
    expect(second.items.map((item) => item.sourceId)).toEqual(["HKAPI-003"]);
  });

  it("rejects an approval update with a stale version without writing audit", async () => {
    const repository = new MemoryPlatformRepository({
      sources: [source("HKAPI-001", "specified_pending_approval", "private")],
    });

    await expect(
      repository.decideSourceApproval(
        {
          sourceId: "HKAPI-001",
          decision: "approved",
          projects: ["P01"],
          purposes: ["P01 beta"],
          storage: "immutable raw and normalized metadata",
          retention: "rights-specific",
          redistribution: "reviewed fields only",
          attribution: "provider attribution required",
          evidenceUrls: ["https://example.gov.hk/review/1"],
          expiresAt: "2027-08-28T10:00:00.000Z",
          reason: "Source terms reviewed",
          actor: "reviewer@example.gov.hk",
          decidedAt: now,
        },
        { expectedVersion: 2 },
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

    expect((await repository.listAudit({ targetId: "HKAPI-001", limit: 20 })).items).toEqual([]);
  });

  it("updates approval and appends before/after hashes atomically", async () => {
    const repository = new MemoryPlatformRepository({
      sources: [source("HKAPI-001", "specified_pending_approval", "private")],
    });

    const decided = await repository.decideSourceApproval(
      {
        sourceId: "HKAPI-001",
        decision: "approved",
        projects: ["P01"],
        purposes: ["P01 beta"],
        storage: "immutable raw and normalized metadata",
        retention: "rights-specific",
        redistribution: "reviewed fields only",
        attribution: "provider attribution required",
        evidenceUrls: ["https://example.gov.hk/review/1"],
        expiresAt: "2027-08-28T10:00:00.000Z",
        reason: "Source terms reviewed",
        actor: "reviewer@example.gov.hk",
        decidedAt: now,
      },
      { expectedVersion: 1 },
    );
    const audit = await repository.listAudit({ targetId: "HKAPI-001", limit: 20 });

    expect(decided).toMatchObject({ approvalStatus: "approved", version: 2 });
    expect(audit.items).toHaveLength(1);
    expect(audit.items[0]).toMatchObject({
      action: "source.approval_decided",
      actor: "reviewer@example.gov.hk",
      targetId: "HKAPI-001",
    });
    expect(audit.items[0]?.beforeHash).not.toBe(audit.items[0]?.afterHash);
  });
});
