import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const contractVersion = "2026-09-01.v1";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a path`);
  }
  return resolve(value);
}

const sourceRoot = resolve(packageRoot, "contracts");
const outputRoot = option("--out", resolve(packageRoot, "contracts"));

const inputs = [
  "source_record.schema.json",
  "canonical_event.schema.json",
  "connector_run.schema.json",
  "monitor_observation.schema.json",
  "incident.schema.json",
  "mcp_allowlist.schema.json",
  "operating-profile.schema.json",
  "openapi.json",
];

mkdirSync(outputRoot, { recursive: true });
const files = {};

for (const name of inputs) {
  const sourcePath = resolve(sourceRoot, name);
  const outputPath = resolve(outputRoot, name);
  if (sourcePath !== outputPath) copyFileSync(sourcePath, outputPath);
  files[name] = createHash("sha256").update(readFileSync(outputPath)).digest("hex");
}

writeFileSync(
  resolve(outputRoot, "contract-manifest.json"),
  `${JSON.stringify({ contract_version: contractVersion, files }, null, 2)}\n`,
  "utf8",
);
