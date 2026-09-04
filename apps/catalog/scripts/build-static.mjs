import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const providerInventoryBytes = await readFile(
  resolve(repositoryRoot, "access/generated/data-gov-resources.json"),
);
const providerInventory = JSON.parse(providerInventoryBytes.toString("utf8"));
const providerEvidence = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "access/verification/data-gov-resources/manifest.json"),
    "utf8",
  ),
);
const inventorySha256 = createHash("sha256").update(providerInventoryBytes).digest("hex");
if (providerEvidence.inventorySha256 !== inventorySha256) {
  throw new Error("provider-resource evidence does not match the current inventory");
}

const publicProviderInventory = {
  ...providerInventory,
  resources: providerInventory.resources.map((resource) => {
    const datasetEvidence = providerEvidence.datasets?.[resource.datasetId];
    const attempt = datasetEvidence?.attempts?.find(
      (candidate) => candidate.resourceId === resource.resourceId,
    );
    const verified =
      datasetEvidence?.outcome === "success" &&
      datasetEvidence.selectedResourceId === resource.resourceId &&
      attempt?.outcome === "success";
    return {
      ...resource,
      verification: {
        status: verified ? "live-verified" : attempt ? "failed" : "metadata-only",
        checkedAt: attempt ? providerEvidence.checkedAt : providerInventory.checkedAt,
        datasetOutcome: datasetEvidence?.outcome ?? "unknown",
        httpStatus: attempt?.httpStatus ?? null,
        mediaType: attempt?.mediaType ?? null,
        sampleBytes: attempt?.sampleBytes ?? null,
        elapsedMs: attempt?.elapsedMs ?? null,
        errorCode: attempt?.errorCode ?? null,
      },
    };
  }),
};
await writeFile(
  resolve(distRoot, "data-gov-resources.json"),
  `${JSON.stringify(publicProviderInventory, null, 2)}\n`,
  "utf8",
);

for (const name of [
  "access-recipes.json",
  "data-gov-resources.json",
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

const providerResourcesCanonical = `${siteRoot}provider-resources/`;
const providerResourcesHtml = indexHtml
  .replaceAll('href="./', 'href="../')
  .replace(/<title>.*?<\/title>/s, "<title>Browse exact provider resources — HK Open Data</title>")
  .replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    '<meta name="description" content="Search exact DATA.GOV.HK provider files and API endpoints, then generate safe cURL, Python, Node and hkdata commands." />',
  )
  .replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${providerResourcesCanonical}" />`,
  );
await mkdir(resolve(distRoot, "provider-resources"), { recursive: true });
await writeFile(
  resolve(distRoot, "provider-resources", "index.html"),
  providerResourcesHtml,
  "utf8",
);
sitemapUrls.push(providerResourcesCanonical);

for (const dataset of providerInventory.datasets ?? []) {
  const encodedId = encodeURIComponent(dataset.datasetId);
  const canonical = `${siteRoot}datasets/${encodedId}/`;
  const description = dataset.description || `${dataset.resourceCount} mapped provider files and endpoints.`;
  const html = indexHtml
    .replace(/<title>.*?<\/title>/s, `<title>${text(dataset.title)} — HK Open Data</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${attribute(description)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(
      "</head>",
      `<script>window.__HK_OPEN_DATA_DATASET_ID__=${JSON.stringify(dataset.datasetId).replaceAll("<", "\\u003c")};</script></head>`,
    );
  const directory = resolve(distRoot, "datasets", encodedId);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), html, "utf8");
  sitemapUrls.push(canonical);
}

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

console.log(
  `generated ${catalogue.resources.length} source pages and ${(providerInventory.datasets ?? []).length} dataset pages`,
);
