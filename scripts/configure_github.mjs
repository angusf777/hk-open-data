import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

async function ghApi(method, path, body) {
  const args = ["api", "--method", method, path];
  const options = { encoding: "utf8" };
  if (body !== undefined) {
    args.push("--input", "-");
    options.input = `${JSON.stringify(body)}\n`;
  }
  const result = spawnSync("gh", args, options);
  if (result.status !== 0) {
    throw new Error(`gh api ${method} ${path} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim() === "" ? {} : JSON.parse(result.stdout);
}

export async function configureRepository(owner, repository, api = ghApi) {
  const repo = `/repos/${owner}/${repository}`;
  const labels = JSON.parse(
    await readFile(resolve(root, ".github/label-definitions.json"), "utf8"),
  );
  await api("PATCH", repo, {
    description:
      "A bilingual catalogue and self-hosted toolkit for Hong Kong public data, APIs and read-only MCP integrations.",
    homepage: `https://${owner}.github.io/${repository}/`,
    has_issues: true,
    has_discussions: true,
    has_wiki: false,
  });
  await api("PUT", `${repo}/topics`, {
    names: [
      "hong-kong",
      "open-data",
      "public-api",
      "data-catalog",
      "mcp",
      "civic-tech",
      "typescript",
      "python",
      "react",
      "fastify",
    ],
  });
  const existing = await api("GET", `${repo}/labels?per_page=100`);
  const names = new Set(existing.map((label) => label.name));
  for (const label of labels) {
    if (names.has(label.name)) {
      await api("PATCH", `${repo}/labels/${encodeURIComponent(label.name)}`, {
        new_name: label.name,
        color: label.color,
        description: label.description,
      });
    } else {
      await api("POST", `${repo}/labels`, label);
    }
  }
  await api("PUT", `${repo}/private-vulnerability-reporting`);
}

async function main() {
  const [owner, repository] = process.argv.slice(2);
  if (!owner || !repository) {
    throw new Error("usage: node scripts/configure_github.mjs OWNER REPOSITORY");
  }
  await configureRepository(owner, repository);
  process.stdout.write(`configured ${owner}/${repository}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
