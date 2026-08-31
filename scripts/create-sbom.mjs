import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, process.argv[2] ?? "artifacts/sbom.cdx.json");
const rootPackage = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const commandEnvironment = { ...process.env, CI: "1", NO_COLOR: "1" };

function npmPurl(name, version) {
  if (name.startsWith("@") && name.includes("/")) {
    const [scope, packageName] = name.split("/", 2);
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function component(ecosystem, name, version, declaredLicense) {
  const purl = ecosystem === "npm"
    ? npmPurl(name, version)
    : `pkg:pypi/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
  return {
    type: "library",
    name,
    version,
    purl,
    licenses: [{ license: { name: declaredLicense } }],
    properties: [{ name: "hk-open-data:ecosystem", value: ecosystem }],
  };
}

const components = new Map();
const pnpmLicenses = JSON.parse(execFileSync(
  "pnpm",
  ["licenses", "list", "--json", "--long"],
  { cwd: root, encoding: "utf8", env: commandEnvironment },
));
for (const [declaredLicense, packages] of Object.entries(pnpmLicenses)) {
  for (const value of packages) {
    for (const version of value.versions) {
      const item = component("npm", value.name, String(version), declaredLicense);
      components.set(item.purl, item);
    }
  }
}

const pythonInventory = `
import importlib.metadata as metadata
import json

rows = []
for distribution in metadata.distributions():
    name = distribution.metadata.get("Name") or ""
    expression = distribution.metadata.get("License-Expression")
    legacy = distribution.metadata.get("License")
    classifiers = [
        value.removeprefix("License :: ")
        for value in distribution.metadata.get_all("Classifier", [])
        if value.startswith("License :: ")
    ]
    declared = (expression or legacy or " OR ".join(classifiers)).strip()
    rows.append({"name": name, "version": distribution.version, "license": declared})
print(json.dumps(rows))
`;
const pythonPackages = JSON.parse(execFileSync(
  "uv",
  ["run", "python", "-c", pythonInventory],
  { cwd: root, encoding: "utf8", env: commandEnvironment },
));
for (const value of pythonPackages) {
  if (!value.name || !value.version || !value.license) {
    throw new Error(`Python distribution has incomplete licence metadata: ${JSON.stringify(value)}`);
  }
  const item = component("pypi", value.name, value.version, value.license);
  components.set(item.purl, item);
}

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: "hk-open-data",
      version: rootPackage.version,
      licenses: [{ license: { id: "Apache-2.0" } }],
    },
  },
  components: [...components.values()].sort((left, right) => left.purl.localeCompare(right.purl)),
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(bom, null, 2)}\n`, { mode: 0o640 });
console.log(`wrote ${bom.components.length} licensed components to ${output}`);
