import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(appRoot, "../..");
const distRoot = resolve(appRoot, "dist");
const siteRoot = "https://angusf777.github.io/hk-open-data/";

execFileSync("uv", ["run", "python", "scripts/catalog.py", "check"], {
  cwd: repositoryRoot,
  stdio: "inherit",
});
execFileSync("pnpm", ["exec", "vite", "build"], { cwd: appRoot, stdio: "inherit" });

for (const name of [
  "access-recipes.json",
  "catalogue.json",
  "counts.json",
  "official.json",
  "external.json",
  "mcp.json",
  "search-index.json",
  "stale.json",
]) {
  await access(resolve(distRoot, name));
}

const catalogue = JSON.parse(await readFile(resolve(distRoot, "catalogue.json"), "utf8"));
if (catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.resources)) {
  throw new Error("built catalogue has an unsupported schema");
}
const indexHtml = await readFile(resolve(distRoot, "index.html"), "utf8");

function attribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function text(value) {
  return attribute(value).replaceAll("'", "&#39;");
}

function resourceHtml(resource) {
  const canonical = `${siteRoot}resources/${encodeURIComponent(resource.id)}/`;
  const title = `${resource.name.en} — HK Open Data`;
  return indexHtml
    .replace(/<title>.*?<\/title>/s, `<title>${text(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${attribute(resource.summary.en)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(
      "</head>",
      `<script>window.__HK_OPEN_DATA_RESOURCE_ID__=${JSON.stringify(resource.id).replaceAll("<", "\\u003c")};</script></head>`,
    );
}

const sitemapUrls = [siteRoot];
for (const resource of catalogue.resources) {
  const encodedId = encodeURIComponent(resource.id);
  const html = resourceHtml(resource);
  const encodedDirectory = resolve(distRoot, "resources", encodedId);
  const decodedDirectory = resolve(distRoot, "resources", resource.id);
  await mkdir(encodedDirectory, { recursive: true });
  await writeFile(resolve(encodedDirectory, "index.html"), html, "utf8");
  if (decodedDirectory !== encodedDirectory) {
    // Static servers commonly decode URL path segments before filesystem lookup.
    await mkdir(decodedDirectory, { recursive: true });
    await writeFile(resolve(decodedDirectory, "index.html"), html, "utf8");
  }
  sitemapUrls.push(`${siteRoot}resources/${encodedId}/`);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls.map((url) => `  <url><loc>${text(url)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await writeFile(resolve(distRoot, "sitemap.xml"), sitemap, "utf8");
await writeFile(
  resolve(distRoot, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${siteRoot}sitemap.xml\n`,
  "utf8",
);
await copyFile(resolve(distRoot, "index.html"), resolve(distRoot, "404.html"));

console.log(`generated ${catalogue.resources.length} static resource pages`);
