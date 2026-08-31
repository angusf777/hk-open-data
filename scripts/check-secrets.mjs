import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignored = new Set(["node_modules", ".git", "dist", ".venv", "artifacts", "test-results", "playwright-report", "__pycache__"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".py", ".json", ".md", ".yaml", ".yml", ".toml", ".tf", ".sql", ".sh", ".env", ""]);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{30,}/,
  /sk-(?:live|proj)-[A-Za-z0-9_-]{20,}/,
];

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name === ".env") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (textExtensions.has(extname(entry.name))) result.push(path);
  }
  return result;
}

const findings = [];
for (const path of await files(root)) {
  if (path.endsWith("scripts/check-secrets.mjs")) continue;
  const content = await readFile(path, "utf8");
  if (patterns.some((pattern) => pattern.test(content))) findings.push(relative(root, path));
}
if (findings.length > 0) throw new Error(`Potential secrets detected in: ${findings.join(", ")}`);
console.log("secret scan passed");
