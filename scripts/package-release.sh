#!/bin/sh
set -eu

version="${1:?usage: package-release.sh VERSION [OUTPUT_DIRECTORY]}"
output="${2:-artifacts}"
root="$(pwd -P)"

case "$version" in
  *[!0-9.]*|.*|*.)
    printf '%s\n' 'version must be a dotted numeric release without a v prefix' >&2
    exit 64
    ;;
esac

if [ "${HKOD_RELEASE_ALLOW_DIRTY:-}" != "test-only" ] && \
   [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  printf '%s\n' 'release packaging requires a clean working tree' >&2
  exit 65
fi

node - "$version" <<'NODE'
const { readFileSync } = require("node:fs");
const version = process.argv[2];
const manifests = [
  "package.json",
  "apps/admin/package.json",
  "apps/catalog/package.json",
  "apps/portal/package.json",
  "packages/schemas/package.json",
  "packages/sdk-typescript/package.json",
  "packages/ui/package.json",
  "services/api/package.json",
  "services/mcp/package.json",
];
for (const path of manifests) {
  const observed = JSON.parse(readFileSync(path, "utf8")).version;
  if (observed !== version) throw new Error(`${path} is ${observed}, expected ${version}`);
}
const pyproject = readFileSync("pyproject.toml", "utf8");
const match = /^version = "([^"]+)"$/m.exec(pyproject);
if (match?.[1] !== version) throw new Error(`pyproject.toml is ${match?.[1]}, expected ${version}`);
NODE

uv run python scripts/catalog.py check

catalogue="hk-open-data-catalogue-v${version}.json"
sbom="hk-open-data-sbom-v${version}.cdx.json"
mkdir -p "$output"
rm -f "$output/$catalogue" "$output/$sbom" "$output/SHA256SUMS"
cp catalog/generated/catalogue.json "$output/$catalogue"
node scripts/create-sbom.mjs "$output/$sbom"

(
  cd "$output"
  shasum -a 256 "$catalogue" "$sbom" > SHA256SUMS
)

(
  cd "$output"
  node "$root/scripts/check-public-boundary.mjs"
)

printf 'release package v%s written to %s\n' "$version" "$output"
