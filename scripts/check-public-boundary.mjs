import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DENIED_SEGMENTS = new Set([
  ".env",
  ".venv",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".terraform",
  "test-results",
  "playwright-report",
  "01_SOURCE_DATA",
  "02_RESEARCH",
  "03_PORTFOLIO",
  "04_IDEAS",
]);

const DENIED_SUFFIXES = [".sqlite", ".sqlite3", ".db", ".pem", ".key", ".xlsx"];
const TEXT_SUFFIXES = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".tf",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const TEXT_NAMES = new Set(["LICENSE", "NOTICE", "Makefile"]);
const SECRET_PATTERN = new RegExp(
  [
    "-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "gh" + "[pousr]_[A-Za-z0-9_]{20,}",
    "AK" + "IA[0-9A-Z]{16}",
  ].join("|"),
);
const PRIVATE_PATH_PATTERN = new RegExp(
  [
    "\\/" + "Users\\/[^/]+\\/",
    "HK_Public_" + "API_Project_Workspace",
    "08_REFERENCE_" + "IMPLEMENTATION_SKELETON",
    "09_BIBLIO" + "GRAPHY",
    "05_SHARED_" + "COMPONENTS",
  ].join("|"),
);

function shouldReadText(name) {
  return TEXT_NAMES.has(name) || TEXT_SUFFIXES.has(path.extname(name).toLowerCase());
}

export async function scanPublicBoundary(root) {
  const findings = [];

  async function inspectFile(absolute, relative) {
    if (
      relative.split(path.sep).some((part) => DENIED_SEGMENTS.has(part)) ||
      DENIED_SUFFIXES.some((suffix) => relative.endsWith(suffix))
    ) {
      findings.push(relative);
      return;
    }

    if (!shouldReadText(path.basename(relative))) return;
    const text = await readFile(absolute, "utf8");
    if (SECRET_PATTERN.test(text)) findings.push(`${relative}:secret-pattern`);
    if (PRIVATE_PATH_PATTERN.test(text)) findings.push(`${relative}:private-path`);
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    );
    const relativeFiles = stdout.split("\0").filter(Boolean).sort();
    for (const relative of relativeFiles) {
      await inspectFile(path.join(root, relative), relative);
    }
    return findings.sort();
  } catch {
    // A non-Git directory is scanned recursively. Tests use this stricter path.
  }

  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);

      if (
        DENIED_SEGMENTS.has(entry.name) ||
        DENIED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))
      ) {
        findings.push(relative);
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) continue;
      await inspectFile(absolute, relative);
    }
  }

  await walk(root);
  return findings.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = await scanPublicBoundary(process.cwd());
  if (findings.length > 0) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  }
}
