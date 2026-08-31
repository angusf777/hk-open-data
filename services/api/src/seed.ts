import type { PostgresPool } from "./postgres.js";
import type { PlatformSeedData } from "./seed-data.js";

export async function seedDatabase(pool: PostgresPool, seed: PlatformSeedData): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const group of seed.sourceGroups) {
      await client.query(
        `INSERT INTO source_group (
           source_group_id, name, provider, source_ids, operator_hint, status,
           created_at, updated_at, version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (source_group_id) DO NOTHING`,
        [
          group.sourceGroupId,
          group.name,
          group.provider,
          group.sourceIds,
          group.operatorHint,
          group.status,
          group.createdAt,
          group.updatedAt,
          group.version,
        ],
      );
    }

    for (const source of seed.sources) {
      const group = seed.sourceGroups.find((candidate) =>
        candidate.sourceIds.includes(source.sourceId),
      );
      await client.query(
        `INSERT INTO source_definition (
           source_id, catalogue_id, catalogue_verified_at, terms_evidence_state,
           source_group_id, projects, name, provider, authority_class,
           approval_status, visibility, freshness_status, last_success_at,
           documentation_url, cadence, approved_uses, limitations, version,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
         ) ON CONFLICT (source_id) DO NOTHING`,
        [
          source.sourceId,
          source.catalogueId ?? null,
          source.catalogueVerifiedAt ?? null,
          source.termsEvidenceState ?? null,
          group?.sourceGroupId ?? null,
          source.projects,
          source.name,
          source.provider,
          source.authorityClass,
          source.approvalStatus,
          source.visibility,
          source.freshnessStatus,
          source.lastSuccessAt,
          source.documentationUrl,
          source.cadence,
          source.approvedUses,
          source.limitations,
          source.version,
          source.createdAt,
          source.updatedAt,
        ],
      );
    }

    for (const target of seed.monitorTargets) {
      await client.query(
        `INSERT INTO monitor_target (
           monitor_id, source_id, source_group_id, provider, name, method,
           request_template, request_body_json, cadence_seconds, timeout_ms,
           freshness_rule, required_checks, public_visibility, activation_status,
           documentation_url, version, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17, $18
         ) ON CONFLICT (monitor_id) DO NOTHING`,
        [
          target.monitorId,
          target.sourceId,
          target.sourceGroupId,
          target.provider,
          target.name,
          target.method,
          target.requestTemplate,
          target.requestBody,
          target.cadenceSeconds,
          target.timeoutMs,
          target.freshnessRule,
          target.requiredChecks,
          target.publicVisibility,
          target.activationStatus,
          target.documentationUrl,
          target.version,
          target.createdAt,
          target.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the seed failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
