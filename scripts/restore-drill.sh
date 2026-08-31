#!/bin/sh
set -eu

mode="${1:-}"
case "$mode" in
  --dry-run)
    printf '%s\n' '{"mode":"dry-run","mutations":false,"checks":["isolated-target","migration-hashes","row-counts","raw-object-sha256","rpo-rto"]}'
    ;;
  --verify)
    inventory="${2:?usage: restore-drill.sh --verify INVENTORY.json}"
    node -e '
      const fs = require("node:fs");
      const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const ok = value.isolated === true && value.schema_migrations_match === true &&
        value.row_counts_match === true && value.raw_hashes_match === true &&
        Number(value.rpo_minutes) <= 15 && Number(value.rto_minutes) <= 240;
      if (!ok) process.exit(2);
      process.stdout.write("restore verification passed\n");
    ' "$inventory"
    ;;
  --local-compose)
    : "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD for the running Compose stack}"

    source_container="$(docker compose ps --status running --quiet postgres)"
    if [ -z "$source_container" ]; then
      printf '%s\n' 'the Compose postgres service is not running' >&2
      exit 69
    fi

    drill_dir="$(mktemp -d "${TMPDIR:-/tmp}/hk-restore-drill.XXXXXX")"
    target_container="hk-restore-drill-$$"
    target_password="local-restore-drill-$$-only"
    target_app_password="local-restore-app-$$-only"
    target_webhook_password="local-restore-webhook-$$-only"
    source_dump="/tmp/hk-restore-drill-$$.dump"
    source_user="${POSTGRES_ADMIN_USER:-hk_admin}"
    source_database="${POSTGRES_DB:-hk_open_data}"
    source_image="$(docker inspect --format '{{.Config.Image}}' "$source_container")"

    cleanup() {
      if docker container inspect "$target_container" >/dev/null 2>&1; then
        docker container rm --force "$target_container" >/dev/null
      fi
      docker exec "$source_container" \
        find /tmp -maxdepth 1 -name "$(basename "$source_dump")" -delete >/dev/null 2>&1 || true
      case "$drill_dir" in
        "${TMPDIR:-/tmp}"/hk-restore-drill.*)
          find "$drill_dir" -depth -delete
          ;;
      esac
    }
    trap cleanup EXIT HUP INT TERM

    backup_started_epoch="$(date +%s)"
    docker exec "$source_container" pg_dump \
      --username "$source_user" \
      --dbname "$source_database" \
      --format custom \
      --no-owner \
      --file "$source_dump"
    docker cp "$source_container:$source_dump" "$drill_dir/database.dump" >/dev/null
    backup_completed_epoch="$(date +%s)"
    backup_sha256="$(shasum -a 256 "$drill_dir/database.dump" | awk '{print $1}')"

    restore_started_epoch="$(date +%s)"
    docker run --detach \
      --name "$target_container" \
      --platform linux/amd64 \
      --network none \
      --env POSTGRES_USER=hk_admin \
      --env POSTGRES_PASSWORD="$target_password" \
      --env POSTGRES_APP_PASSWORD="$target_app_password" \
      --env POSTGRES_WEBHOOK_PASSWORD="$target_webhook_password" \
      --env POSTGRES_DB=restore_control \
      "$source_image" >/dev/null

    attempt=0
    until docker exec "$target_container" pg_isready \
      --host 127.0.0.1 --username hk_admin --dbname restore_control >/dev/null 2>&1; do
      attempt=$((attempt + 1))
      if [ "$attempt" -ge 60 ]; then
        printf '%s\n' 'isolated restore target did not become ready' >&2
        exit 70
      fi
      sleep 1
    done

    docker exec "$target_container" psql \
      --set ON_ERROR_STOP=1 \
      --username hk_admin \
      --dbname restore_control \
      --command "CREATE DATABASE hk_open_data" \
      >/dev/null
    docker cp "$drill_dir/database.dump" "$target_container:/tmp/database.dump" >/dev/null
    docker exec "$target_container" pg_restore \
      --exit-on-error \
      --no-owner \
      --username hk_admin \
      --dbname hk_open_data \
      /tmp/database.dump

    migrations_sql="SELECT coalesce(jsonb_agg(jsonb_build_array(name, sha256) ORDER BY name), '[]'::jsonb)::text FROM schema_migration"
    counts_sql="SELECT jsonb_build_object('source_group',(SELECT count(*) FROM source_group),'source_definition',(SELECT count(*) FROM source_definition),'monitor_target',(SELECT count(*) FROM monitor_target),'raw_object',(SELECT count(*) FROM raw_object),'audit_entry',(SELECT count(*) FROM audit_entry),'subscription',(SELECT count(*) FROM subscription),'delivery_attempt',(SELECT count(*) FROM delivery_attempt))::text"
    raw_sql="SELECT coalesce(jsonb_agg(sha256 ORDER BY sha256), '[]'::jsonb)::text FROM raw_object"
    raw_count_sql="SELECT count(*) FROM raw_object"

    source_migrations="$(docker exec "$source_container" psql --tuples-only --no-align --username "$source_user" --dbname "$source_database" --command "$migrations_sql")"
    target_migrations="$(docker exec "$target_container" psql --tuples-only --no-align --username hk_admin --dbname hk_open_data --command "$migrations_sql")"
    source_counts="$(docker exec "$source_container" psql --tuples-only --no-align --username "$source_user" --dbname "$source_database" --command "$counts_sql")"
    target_counts="$(docker exec "$target_container" psql --tuples-only --no-align --username hk_admin --dbname hk_open_data --command "$counts_sql")"
    source_raw_hashes="$(docker exec "$source_container" psql --tuples-only --no-align --username "$source_user" --dbname "$source_database" --command "$raw_sql")"
    target_raw_hashes="$(docker exec "$target_container" psql --tuples-only --no-align --username hk_admin --dbname hk_open_data --command "$raw_sql")"
    source_raw_count="$(docker exec "$source_container" psql --tuples-only --no-align --username "$source_user" --dbname "$source_database" --command "$raw_count_sql")"

    schema_migrations_match=false
    row_counts_match=false
    database_raw_hashes_match=false
    object_bytes_restored=false
    [ "$source_migrations" = "$target_migrations" ] && schema_migrations_match=true
    [ "$source_counts" = "$target_counts" ] && row_counts_match=true
    [ "$source_raw_hashes" = "$target_raw_hashes" ] && database_raw_hashes_match=true
    [ "$source_raw_count" = "0" ] && object_bytes_restored=true

    restore_completed_epoch="$(date +%s)"
    inventory="$drill_dir/restore-inventory.json"
    INVENTORY_PATH="$inventory" \
    BACKUP_SHA256="$backup_sha256" \
    BACKUP_STARTED_EPOCH="$backup_started_epoch" \
    BACKUP_COMPLETED_EPOCH="$backup_completed_epoch" \
    RESTORE_STARTED_EPOCH="$restore_started_epoch" \
    RESTORE_COMPLETED_EPOCH="$restore_completed_epoch" \
    TARGET_CONTAINER="$target_container" \
    SCHEMA_MIGRATIONS_MATCH="$schema_migrations_match" \
    ROW_COUNTS_MATCH="$row_counts_match" \
    DATABASE_RAW_HASHES_MATCH="$database_raw_hashes_match" \
    OBJECT_BYTES_RESTORED="$object_bytes_restored" \
    SOURCE_RAW_COUNT="$source_raw_count" \
    SOURCE_COUNTS="$source_counts" \
    node -e '
      const fs = require("node:fs");
      const number = (name) => Number(process.env[name]);
      const value = {
        mode: "local-compose",
        isolated: true,
        isolated_target: process.env.TARGET_CONTAINER,
        backup_identifier: `sha256:${process.env.BACKUP_SHA256}`,
        schema_migrations_match: process.env.SCHEMA_MIGRATIONS_MATCH === "true",
        row_counts_match: process.env.ROW_COUNTS_MATCH === "true",
        database_raw_hashes_match: process.env.DATABASE_RAW_HASHES_MATCH === "true",
        object_bytes_restored: process.env.OBJECT_BYTES_RESTORED === "true",
        raw_hashes_match:
          process.env.DATABASE_RAW_HASHES_MATCH === "true" &&
          process.env.OBJECT_BYTES_RESTORED === "true",
        raw_object_count: number("SOURCE_RAW_COUNT"),
        source_row_counts: JSON.parse(process.env.SOURCE_COUNTS),
        rpo_minutes: Number(((number("RESTORE_COMPLETED_EPOCH") - number("BACKUP_COMPLETED_EPOCH")) / 60).toFixed(3)),
        rto_minutes: Number(((number("RESTORE_COMPLETED_EPOCH") - number("RESTORE_STARTED_EPOCH")) / 60).toFixed(3)),
        backup_duration_seconds: number("BACKUP_COMPLETED_EPOCH") - number("BACKUP_STARTED_EPOCH"),
        restore_duration_seconds: number("RESTORE_COMPLETED_EPOCH") - number("RESTORE_STARTED_EPOCH"),
      };
      fs.writeFileSync(process.env.INVENTORY_PATH, `${JSON.stringify(value, null, 2)}\n`);
    '

    "$0" --verify "$inventory"
    printf '%s\n' 'local isolated restore inventory:'
    tr -d '\n' < "$inventory"
    printf '\n'
    ;;
  *)
    printf '%s\n' 'usage: restore-drill.sh --dry-run | --verify INVENTORY.json | --local-compose' >&2
    exit 64
    ;;
esac
