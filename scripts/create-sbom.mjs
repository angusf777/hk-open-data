import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, process.argv[2] ?? "artifacts/sbom.cdx.json");
const rootPackage = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const packageFiles = [
  "package.json", "services/api/package.json", "services/mcp/package.json",
  "packages/sdk-typescript/package.json", "packages/schemas/package.json", "packages/ui/package.json",
  "apps/admin/package.json", "apps/portal/package.json", "apps/catalog/package.json",
];
const components = new Map();
for (const file of packageFiles) {
  const value = JSON.parse(await readFile(resolve(root, file), "utf8"));
  for (const [name, version] of Object.entries({ ...(value.dependencies ?? {}), ...(value.devDependencies ?? {}) })) {
    components.set(`npm:${name}@${version}`, { type: "library", name, version: String(version), purl: `pkg:npm/${encodeURIComponent(name)}@${version}` });
  }
}
const uvLock = await readFile(resolve(root, "uv.lock"), "utf8");
for (const match of uvLock.matchAll(/name = "([^"]+)"\nversion = "([^"]+)"/g)) {
  components.set(`pypi:${match[1]}@${match[2]}`, { type: "library", name: match[1], version: match[2], purl: `pkg:pypi/${match[1]}@${match[2]}` });
}
const bom = { bomFormat: "CycloneDX", specVersion: "1.6", version: 1, metadata: { component: { type: "application", name: "hk-open-data", version: rootPackage.version } }, components: [...components.values()].sort((a, b) => a.purl.localeCompare(b.purl)) };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(bom, null, 2)}\n`, { mode: 0o640 });
console.log(`wrote ${bom.components.length} components to ${output}`);
