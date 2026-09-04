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
execFileSync(
  "uv",
  ["run", "python", "-m", "scripts.export_snapshots", resolve(distRoot, "downloads")],
  { cwd: repositoryRoot, stdio: "inherit" },
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
let indexHtml = await readFile(resolve(distRoot, "index.html"), "utf8");

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

function withJsonLd(html, value) {
  const payload = JSON.stringify(value).replaceAll("<", "\\u003c");
  return html.replace(
    "</head>",
    `<script type="application/ld+json">${payload}</script></head>`,
  );
}

indexHtml = withJsonLd(indexHtml, {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "HK Open Data",
  url: siteRoot,
  description:
    "A bilingual, evidence-labelled catalogue and optional self-hosted toolkit for Hong Kong public-data sources.",
  isAccessibleForFree: true,
  license: "https://www.apache.org/licenses/LICENSE-2.0",
});
await writeFile(resolve(distRoot, "index.html"), indexHtml, "utf8");

function resourceHtml(resource) {
  const canonical = `${siteRoot}resources/${encodeURIComponent(resource.id)}/`;
  const title = `${resource.name.en} — HK Open Data`;
  const html = indexHtml
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
  return withJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: canonical,
    name: resource.name.en,
    description: resource.summary.en,
    about: {
      "@type": "CreativeWork",
      identifier: resource.sourceReference,
      name: resource.name.en,
      url: resource.urls.landing ?? canonical,
      provider: { "@type": "Organization", name: resource.provider.name.en },
    },
  });
}

const sitemapUrls = [siteRoot];

const providerResourcesCanonical = `${siteRoot}provider-resources/`;
const providerResourcesHtml = withJsonLd(
  indexHtml
  .replaceAll('href="./', 'href="../')
  .replace(/<title>.*?<\/title>/s, "<title>Browse exact provider resources — HK Open Data</title>")
  .replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    '<meta name="description" content="Search exact DATA.GOV.HK provider files and API endpoints, then generate safe cURL, Python, Node and hkdata commands." />',
  )
  .replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${providerResourcesCanonical}" />`,
    ),
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: providerResourcesCanonical,
    name: "DATA.GOV.HK provider files and endpoints",
    numberOfItems: publicProviderInventory.resources.length,
  },
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
  const html = withJsonLd(
    indexHtml
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
      ),
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      identifier: dataset.datasetId,
      name: dataset.title,
      description,
      url: canonical,
      sameAs: dataset.landingUrl,
      distribution: (publicProviderInventory.resources ?? [])
        .filter((resource) => resource.datasetId === dataset.datasetId)
        .map((resource) => ({
          "@type": "DataDownload",
          name: resource.name,
          encodingFormat: resource.format,
          contentUrl: resource.urlTemplate,
        })),
    },
  );
  const directory = resolve(distRoot, "datasets", encodedId);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), html, "utf8");
  sitemapUrls.push(canonical);
}

const categories = [...new Set(catalogue.resources.flatMap((resource) => resource.categories))].sort();
for (const category of categories) {
  const matching = catalogue.resources.filter((resource) => resource.categories.includes(category));
  const canonical = `${siteRoot}categories/${encodeURIComponent(category)}/`;
  const categoryName = category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const description = `Browse ${matching.length} HK Open Data catalogue sources in ${categoryName}.`;
  const html = withJsonLd(
    indexHtml
      .replaceAll('href="./', 'href="../')
      .replace(/<title>.*?<\/title>/s, `<title>${text(categoryName)} — HK Open Data</title>`)
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
        `<script>window.__HK_OPEN_DATA_CATEGORY__=${JSON.stringify(category)};</script></head>`,
      ),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: canonical,
      name: `${categoryName} — HK Open Data`,
      description,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: matching.length,
        itemListElement: matching.map((resource, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${siteRoot}resources/${encodeURIComponent(resource.id)}/`,
          name: resource.name.en,
        })),
      },
    },
  );
  const directory = resolve(distRoot, "categories", encodeURIComponent(category));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), html, "utf8");
  sitemapUrls.push(canonical);
}

const dcat = {
  "@context": {
    dcat: "http://www.w3.org/ns/dcat#",
    dct: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
  },
  "@id": siteRoot,
  "@type": "dcat:Catalog",
  "dct:title": "HK Open Data",
  "dct:description":
    "Independent catalogue metadata for Hong Kong public-data sources; provider rights and terms remain controlling.",
  "dct:license": "https://www.apache.org/licenses/LICENSE-2.0",
  "dcat:resource": catalogue.resources.map((resource) => ({
    "@id": `${siteRoot}resources/${encodeURIComponent(resource.id)}/`,
    "@type": "dcat:Resource",
    "dct:identifier": resource.sourceReference,
    "dct:title": resource.name.en,
    "dct:description": resource.summary.en,
    "dct:publisher": { "@type": "foaf:Agent", "foaf:name": resource.provider.name.en },
    ...(resource.urls.landing ? { "dcat:landingPage": resource.urls.landing } : {}),
  })),
};
await writeFile(resolve(distRoot, "dcat.jsonld"), `${JSON.stringify(dcat, null, 2)}\n`, "utf8");
await copyFile(resolve(repositoryRoot, "llms.txt"), resolve(distRoot, "llms.txt"));
await mkdir(resolve(distRoot, "contracts"), { recursive: true });
for (const name of [
  "openapi.json",
  "canonical_event.schema.json",
  "incident.schema.json",
  "monitor_observation.schema.json",
  "source_record.schema.json",
]) {
  await copyFile(
    resolve(repositoryRoot, "packages/schemas/contracts", name),
    resolve(distRoot, "contracts", name),
  );
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
  `generated ${catalogue.resources.length} source pages, ${(providerInventory.datasets ?? []).length} dataset pages and ${categories.length} category pages`,
);
