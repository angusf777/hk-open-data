import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function clean(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ").trim();
}

export function renderHealthIssue(report) {
  const findings = (report.findings ?? [])
    .filter((item) => !["ok", "redirected"].includes(item.status))
    .toSorted((left, right) =>
      `${left.resource_id}:${left.field}:${left.status}`.localeCompare(
        `${right.resource_id}:${right.field}:${right.status}`,
      ),
    );
  const fingerprintInput = findings.map((item) => ({
    resource_id: item.resource_id,
    field: item.field,
    url: item.url,
    status: item.status,
    http_status: item.http_status ?? null,
  }));
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(fingerprintInput))
    .digest("hex");
  const lines = [
    "# Automated catalogue health report",
    "",
    `<!-- hk-open-data-health:${fingerprint} -->`,
    "",
    `Generated: ${clean(report.generatedAt) || "unknown"}`,
    "",
    "This report records reachability and evidence-age observations only. It does not determine",
    "commercial-use, caching, redistribution, or other legal permissions.",
    "",
  ];
  if (findings.length === 0) {
    lines.push("No current link or staleness findings.", "");
  } else {
    lines.push(
      `Current findings: ${findings.length}`,
      "",
      "| Resource | Field | Status | HTTP | Attempts | URL |",
      "| --- | --- | --- | ---: | ---: | --- |",
      ...findings.slice(0, 200).map((item) =>
        `| ${clean(item.resource_id)} | ${clean(item.field)} | ${clean(item.status)} | ${clean(item.http_status ?? "—")} | ${clean(item.attempts)} | ${clean(item.url)} |`,
      ),
      "",
    );
    if (findings.length > 200) {
      lines.push(`${findings.length - 200} additional findings remain in the attached workflow artifact.`, "");
    }
  }
  lines.push(
    "No catalogue records were changed or deleted. A maintainer should re-check authoritative",
    "sources before editing catalogue evidence.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  const input = resolve(process.argv[2] ?? "catalog/generated/link-health.json");
  const output = resolve(process.argv[3] ?? "catalog/generated/link-health.md");
  const report = JSON.parse(await readFile(input, "utf8"));
  await writeFile(output, renderHealthIssue(report), { encoding: "utf8", mode: 0o640 });
  process.stdout.write(`${output}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
