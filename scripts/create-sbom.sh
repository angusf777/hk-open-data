#!/bin/sh
set -eu
node "$(dirname "$0")/create-sbom.mjs" "${1:-artifacts/sbom.cdx.json}"
