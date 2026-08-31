import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const contractRoot = resolve(root, "packages/schemas/contracts");
const manifest = JSON.parse(
  await readFile(resolve(contractRoot, "contract-manifest.json"), "utf8"),
);

for (const [name, expected] of Object.entries(manifest.files)) {
  const body = await readFile(resolve(contractRoot, name));
  const observed = createHash("sha256").update(body).digest("hex");
  if (observed !== expected) throw new Error(`Contract drift: ${name} hash differs from manifest`);
}

const denied = new RegExp(
  [
    "HK_Public_" + "API_Project_Workspace",
    "09_BIBLIO" + "GRAPHY",
    "05_SHARED_" + "COMPONENTS",
    "08_REFERENCE_" + "IMPLEMENTATION_SKELETON",
    "\\/Users\\/",
  ].join("|"),
);
const rootsToScan = ["apps", "packages", "services", "infra", "tests", "scripts"];
const textSuffixes = new Set([".json", ".md", ".mjs", ".py", ".sh", ".ts", ".tsx", ".yml"]);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["dist", "node_modules", "__pycache__"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (textSuffixes.has(entry.name.slice(entry.name.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

for (const directory of rootsToScan) {
  for (const path of await walk(resolve(root, directory))) {
    if (denied.test(await readFile(path, "utf8"))) {
      throw new Error(`Private source path in runtime file: ${path.slice(root.length + 1)}`);
    }
  }
}

console.log(`contract drift check passed (${Object.keys(manifest.files).length} contracts)`);
