import type {
  ProviderResource,
  ProviderResourceAccess,
  ProviderResourceKind,
  ProviderResourceVerificationStatus,
} from "./types";

export type ProviderResourceLanguage = "curl" | "python" | "node" | "hkdata";

export interface ProviderResourceFilters {
  query: string;
  access: ProviderResourceAccess | "all";
  format: string;
  kind: ProviderResourceKind | "all";
  verification: ProviderResourceVerificationStatus | "all";
}

const MAX_BYTES = 25 * 1024 * 1024;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}|<([A-Za-z][A-Za-z0-9_]*)>/;

export function filterProviderResources(
  resources: ProviderResource[],
  filters: ProviderResourceFilters,
): ProviderResource[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return resources.filter((resource) => {
    if (filters.access !== "all" && resource.access !== filters.access) return false;
    if (filters.format !== "all" && resource.format !== filters.format) return false;
    if (filters.kind !== "all" && resource.resourceKind !== filters.kind) return false;
    if (
      filters.verification !== "all" &&
      resource.verification.status !== filters.verification
    ) return false;
    if (terms.length === 0) return true;
    const haystack = [
      resource.name,
      resource.datasetId,
      resource.resourceId,
      resource.format,
      resource.urlTemplate,
      ...resource.sourceReferences,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function providerResourceFormats(resources: ProviderResource[]): string[] {
  return [...new Set(resources.map((resource) => resource.format))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function resolveProviderResourceUrl(
  resource: ProviderResource,
  parameters: Record<string, string>,
): string | null {
  if (!resource.urlTemplate.startsWith("https://")) return null;
  if (resource.templateParameters.some((name) => !parameters[name]?.trim())) return null;
  let resolved = resource.urlTemplate;
  for (const name of resource.templateParameters) {
    const encoded = encodeURIComponent(parameters[name]!.trim()).replaceAll("'", "%27");
    resolved = resolved.replaceAll(`{${name}}`, encoded).replaceAll(`<${name}>`, encoded);
  }
  return PLACEHOLDER.test(resolved) ? null : resolved;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function shellArgument(value: string): string {
  return /^[A-Za-z0-9._:=/-]+$/.test(value) ? value : shellQuote(value);
}

export function renderProviderResourceCommand(
  resource: ProviderResource,
  language: ProviderResourceLanguage,
  parameters: Record<string, string>,
): string | null {
  if (
    !["api", "file"].includes(resource.resourceKind) ||
    resource.verification.status !== "live-verified"
  ) {
    return null;
  }
  const url = resolveProviderResourceUrl(resource, parameters);
  if (!url) return null;
  if (language === "curl") {
    return (
      "curl --fail-with-body --max-time 30 --proto '=https' " +
      `--max-filesize ${MAX_BYTES} --remove-on-error --no-clobber ` +
      `--output resource.data ${shellQuote(url)}`
    );
  }
  if (language === "python") {
    return `from pathlib import Path

import httpx

url = ${JSON.stringify(url)}
headers = {"Accept": "*/*", "User-Agent": "hk-open-data-example/1"}
payload = bytearray()
with httpx.Client(timeout=30, follow_redirects=False) as client:
    with client.stream("GET", url, headers=headers) as response:
        if not 200 <= response.status_code < 300:
            raise RuntimeError(f"provider returned HTTP \${response.status_code}")
        for chunk in response.iter_bytes():
            if len(payload) + len(chunk) > ${MAX_BYTES}:
                raise RuntimeError("resource exceeds the 25 MiB example limit")
            payload.extend(chunk)
with Path("resource.data").open("xb") as output:
    output.write(payload)`;
  }
  if (language === "node") {
    return `import { writeFile } from "node:fs/promises";

const response = await fetch(${JSON.stringify(url)}, {
  headers: { accept: "*/*", "user-agent": "hk-open-data-example/1" },
  signal: AbortSignal.timeout(30_000),
  redirect: "manual",
});
if (!response.ok) throw new Error(\`resource returned \${response.status}\`);
if (!response.body) throw new Error("resource returned no body");
const reader = response.body.getReader();
const chunks = [];
let totalBytes = 0;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  if (!value) continue;
  totalBytes += value.byteLength;
  if (totalBytes > ${MAX_BYTES}) {
    await reader.cancel();
    throw new Error("resource exceeds 25 MiB");
  }
  chunks.push(value);
}
const payload = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
await writeFile("resource.data", payload, { flag: "wx" });`;
  }
  const source = resource.sourceReferences[0];
  if (!source) return null;
  const parameterArguments = resource.templateParameters
    .map((name) => ` --param ${shellArgument(`${name}=${parameters[name]!.trim()}`)}`)
    .join("");
  return (
    `hkdata fetch-resource ${shellArgument(source)} ${shellArgument(resource.resourceId)} ` +
    `--dataset ${shellArgument(resource.datasetId)} --max-bytes ${MAX_BYTES} ` +
    `--output resource.data${parameterArguments}`
  );
}
