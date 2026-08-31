#!/bin/sh
set -eu

docker info >/dev/null

if [ -z "${DOCKER_HOST:-}" ]; then
  detected_docker_host="$(docker context inspect --format '{{ (index .Endpoints "docker").Host }}')"
  if [ -n "$detected_docker_host" ]; then
    export DOCKER_HOST="$detected_docker_host"
  fi
fi

case "${DOCKER_HOST:-}" in
  unix://*)
    export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE="${TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE:-/var/run/docker.sock}"
    ;;
esac

export RUN_DOCKER_TESTS=1
export POSTGRES_TEST_IMAGE="hk-public-data-integrated-postgres:16-3.5"

docker build \
  --platform linux/amd64 \
  --tag "$POSTGRES_TEST_IMAGE" \
  --file infra/docker/postgres.Dockerfile \
  ..
pnpm --filter @hk-open-data/api exec vitest run src/postgres-container.test.ts
uv run pytest tests/integration/test_compose_config.py -q
