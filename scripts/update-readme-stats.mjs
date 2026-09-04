import { readFile, writeFile } from "node:fs/promises";

const counts = JSON.parse(await readFile("catalog/generated/counts.json", "utf8"));
const start = "<!-- catalog-counts:start -->";
const end = "<!-- catalog-counts:end -->";
const checkOnly = process.argv.includes("--check");

const files = {
  "README.md": `**${counts.total} sources** · **${counts.byType.official} official** · **${counts.byType.external} external** · **${counts.byType.mcp} MCP candidates**`,
  "README.zh-HK.md": `**${counts.total} 項資源** · **${counts.byType.official} 項官方資源** · **${counts.byType.external} 項外部資源** · **${counts.byType.mcp} 項 MCP 候選項目**`,
};

let drift = false;

for (const [file, generated] of Object.entries(files)) {
  const original = await readFile(file, "utf8");
  const first = original.indexOf(start);
  const last = original.indexOf(end);

  if (first < 0 || last < 0 || original.indexOf(start, first + start.length) >= 0 || original.indexOf(end, last + end.length) >= 0 || last < first) {
    throw new Error(`${file} must contain exactly one ordered catalogue count region`);
  }

  const updated = `${original.slice(0, first)}${start}\n${generated}\n${end}${original.slice(last + end.length)}`;
  if (updated === original) continue;

  drift = true;
  if (!checkOnly) await writeFile(file, updated);
}

if (checkOnly && drift) {
  console.error("README catalogue statistics are out of date; run node scripts/update-readme-stats.mjs");
  process.exitCode = 1;
}
