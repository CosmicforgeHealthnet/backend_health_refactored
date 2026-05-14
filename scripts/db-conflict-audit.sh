#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Read-only Postgres audit for comparing development and production databases.

Modes:
  DB_AUDIT_MODE=docker  Uses psql inside the Postgres Docker container.
  DB_AUDIT_MODE=direct  Uses local psql and DB credentials from env files.

Docker defaults are tuned for the VPS setup:
  PG_CONTAINER=shared-postgres
  PGUSER=postgres
  DEV_DB=cosmicforge_clean
  PROD_DB=cosmicforge_v2

Direct mode defaults:
  DEV_ENV_FILE=.env.development
  PROD_ENV_FILE=.env.production

LAB-owned tables are excluded by default because LAB is a separate microservice:
  AUDIT_EXCLUDE_TABLES=lab_facilities,lab_orders,lab_order_items,lab_personnel,lab_wallets,lab_wallet_transactions,lab_wallet_topups,lab_test_requests

Set AUDIT_EXCLUDE_TABLES="" to include every table, or provide your own comma/space-separated list.

Examples:
  bash scripts/db-conflict-audit.sh
  DEV_DB=cosmicforge_clean PROD_DB=cosmicforge_v2 bash scripts/db-conflict-audit.sh
  PG_CONTAINER=my-postgres PGUSER=postgres OUT_DIR=/tmp/audit bash scripts/db-conflict-audit.sh
  DB_AUDIT_MODE=direct bash scripts/db-conflict-audit.sh
  DB_AUDIT_MODE=direct DEV_ENV_FILE=.env.development PROD_ENV_FILE=.env.production bash scripts/db-conflict-audit.sh
  AUDIT_EXCLUDE_TABLES="" DB_AUDIT_MODE=direct bash scripts/db-conflict-audit.sh

The script only runs SELECT queries. It writes TSV/hash/diff reports to OUT_DIR.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

DB_AUDIT_MODE="$(printf '%s' "${DB_AUDIT_MODE:-docker}" | tr '[:upper:]' '[:lower:]')"
OUT_DIR="${OUT_DIR:-/tmp/db-sync-audit-$(date +%Y%m%d-%H%M%S)}"
DEFAULT_AUDIT_EXCLUDE_TABLES="lab_facilities,lab_orders,lab_order_items,lab_personnel,lab_wallets,lab_wallet_transactions,lab_wallet_topups,lab_test_requests"
AUDIT_EXCLUDE_TABLES="${AUDIT_EXCLUDE_TABLES-$DEFAULT_AUDIT_EXCLUDE_TABLES}"

mkdir -p "$OUT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

read_env_value() {
  local file="$1"
  local key="$2"
  local line
  local value

  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value//$'\r'/}"

  if [[ ${#value} -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi

  printf '%s' "$value"
}

require_value() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "Missing required direct-mode DB setting: $name" >&2
    exit 1
  fi
}

mask_host() {
  local host="$1"

  if [[ -z "$host" ]]; then
    printf 'unknown'
  elif [[ "$host" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    printf '%s.***.***.%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[4]}"
  elif [[ "$host" == *.* ]]; then
    printf '%s.***.%s' "${host%%.*}" "${host##*.}"
  elif [[ "$host" == *:* ]]; then
    printf '%s:***' "${host%%:*}"
  else
    printf '%s' "$host"
  fi
}

ssl_mode_from_flag() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"

  case "$value" in
    true|1|require)
      printf 'require'
      ;;
    false|0|disable)
      printf 'disable'
      ;;
    verify-ca|verify-full)
      printf '%s' "$value"
      ;;
    *)
      printf 'prefer'
      ;;
  esac
}

sql_quote_literal() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "$value"
}

normalize_table_list() {
  local raw="${1//,/ }"
  local item
  local list=""

  for item in $raw; do
    [[ -z "$item" ]] && continue
    if [[ -n "$list" ]]; then
      list+=","
    fi
    list+="$item"
  done

  printf '%s' "$list"
}

build_excluded_tables_sql() {
  local normalized="${1//,/ }"
  local item
  local list=""

  for item in $normalized; do
    [[ -z "$item" ]] && continue
    if [[ -n "$list" ]]; then
      list+=", "
    fi
    list+="$(sql_quote_literal "$item")"
  done

  if [[ -z "$list" ]]; then
    printf 'array[]::text[]'
  else
    printf 'array[%s]::text[]' "$list"
  fi
}

configure_docker_mode() {
  PG_CONTAINER="${PG_CONTAINER:-shared-postgres}"
  PGUSER="${PGUSER:-postgres}"
  DEV_DB="${DEV_DB:-cosmicforge_clean}"
  PROD_DB="${PROD_DB:-cosmicforge_v2}"

  require_cmd docker

  if ! docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
    echo "Postgres container not found: $PG_CONTAINER" >&2
    echo "Set PG_CONTAINER to the container name that has psql access." >&2
    exit 1
  fi
}

configure_direct_mode() {
  DEV_ENV_FILE="${DEV_ENV_FILE:-.env.development}"
  PROD_ENV_FILE="${PROD_ENV_FILE:-.env.production}"

  require_cmd psql

  if [[ ! -f "$DEV_ENV_FILE" ]]; then
    echo "Development env file not found: $DEV_ENV_FILE" >&2
    exit 1
  fi

  if [[ ! -f "$PROD_ENV_FILE" ]]; then
    echo "Production env file not found: $PROD_ENV_FILE" >&2
    exit 1
  fi

  DEV_HOST="${DEV_HOST:-${DEV_DB_HOST:-$(read_env_value "$DEV_ENV_FILE" DB_HOST)}}"
  DEV_PORT="${DEV_PORT:-${DEV_DB_PORT:-$(read_env_value "$DEV_ENV_FILE" DB_PORT)}}"
  DEV_USER="${DEV_USER:-${DEV_DB_USER:-$(read_env_value "$DEV_ENV_FILE" DB_USER)}}"
  DEV_PASS="${DEV_PASS:-${DEV_DB_PASS:-$(read_env_value "$DEV_ENV_FILE" DB_PASS)}}"
  DEV_DB="${DEV_DB:-$(read_env_value "$DEV_ENV_FILE" DB_NAME)}"
  DEV_SSL="${DEV_SSL:-${DEV_DB_SSL:-$(read_env_value "$DEV_ENV_FILE" DB_SSL)}}"

  PROD_HOST="${PROD_HOST:-${PROD_DB_HOST:-$(read_env_value "$PROD_ENV_FILE" DB_HOST)}}"
  PROD_PORT="${PROD_PORT:-${PROD_DB_PORT:-$(read_env_value "$PROD_ENV_FILE" DB_PORT)}}"
  PROD_USER="${PROD_USER:-${PROD_DB_USER:-$(read_env_value "$PROD_ENV_FILE" DB_USER)}}"
  PROD_PASS="${PROD_PASS:-${PROD_DB_PASS:-$(read_env_value "$PROD_ENV_FILE" DB_PASS)}}"
  PROD_DB="${PROD_DB:-$(read_env_value "$PROD_ENV_FILE" DB_NAME)}"
  PROD_SSL="${PROD_SSL:-${PROD_DB_SSL:-$(read_env_value "$PROD_ENV_FILE" DB_SSL)}}"

  DEV_PORT="${DEV_PORT:-5432}"
  PROD_PORT="${PROD_PORT:-5432}"
  DEV_SSLMODE="$(ssl_mode_from_flag "$DEV_SSL")"
  PROD_SSLMODE="$(ssl_mode_from_flag "$PROD_SSL")"
  PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

  require_value "DEV_HOST / DB_HOST in $DEV_ENV_FILE" "$DEV_HOST"
  require_value "DEV_USER / DB_USER in $DEV_ENV_FILE" "$DEV_USER"
  require_value "DEV_DB / DB_NAME in $DEV_ENV_FILE" "$DEV_DB"
  require_value "PROD_HOST / DB_HOST in $PROD_ENV_FILE" "$PROD_HOST"
  require_value "PROD_USER / DB_USER in $PROD_ENV_FILE" "$PROD_USER"
  require_value "PROD_DB / DB_NAME in $PROD_ENV_FILE" "$PROD_DB"
}

case "$DB_AUDIT_MODE" in
  docker)
    configure_docker_mode
    ;;
  direct)
    configure_direct_mode
    ;;
  *)
    echo "Unsupported DB_AUDIT_MODE: $DB_AUDIT_MODE" >&2
    echo "Use DB_AUDIT_MODE=docker or DB_AUDIT_MODE=direct." >&2
    exit 1
    ;;
esac

AUDIT_EXCLUDE_TABLES_NORMALIZED="$(normalize_table_list "$AUDIT_EXCLUDE_TABLES")"
EXCLUDED_TABLES_SQL="$(build_excluded_tables_sql "$AUDIT_EXCLUDE_TABLES_NORMALIZED")"

target_db() {
  case "$1" in
    dev) printf '%s' "$DEV_DB" ;;
    prod) printf '%s' "$PROD_DB" ;;
    *)
      echo "Unknown audit target: $1" >&2
      exit 1
      ;;
  esac
}

sql() {
  local target="$1"
  local query="$2"

  case "$DB_AUDIT_MODE" in
    docker)
      docker exec "$PG_CONTAINER" \
        psql -X -q -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$(target_db "$target")" -AtF $'\t' \
        -c "BEGIN READ ONLY; ${query}; COMMIT;"
      ;;
    direct)
      local host
      local port
      local user
      local pass
      local db
      local sslmode

      if [[ "$target" == "dev" ]]; then
        host="$DEV_HOST"
        port="$DEV_PORT"
        user="$DEV_USER"
        pass="$DEV_PASS"
        db="$DEV_DB"
        sslmode="$DEV_SSLMODE"
      elif [[ "$target" == "prod" ]]; then
        host="$PROD_HOST"
        port="$PROD_PORT"
        user="$PROD_USER"
        pass="$PROD_PASS"
        db="$PROD_DB"
        sslmode="$PROD_SSLMODE"
      else
        echo "Unknown audit target: $target" >&2
        exit 1
      fi

      PGPASSWORD="$pass" PGSSLMODE="$sslmode" PGCONNECT_TIMEOUT="$PGCONNECT_TIMEOUT" \
        psql -X -q -v ON_ERROR_STOP=1 -h "$host" -p "$port" -U "$user" -d "$db" -AtF $'\t' \
        -c "BEGIN READ ONLY; ${query}; COMMIT;"
      ;;
  esac
}

target_description() {
  local target="$1"

  if [[ "$DB_AUDIT_MODE" == "docker" ]]; then
    printf '%s via container %s database %s user %s' "$target" "$PG_CONTAINER" "$(target_db "$target")" "$PGUSER"
  elif [[ "$target" == "dev" ]]; then
    printf '%s database %s at %s:%s user %s sslmode=%s' "$target" "$DEV_DB" "$(mask_host "$DEV_HOST")" "$DEV_PORT" "$DEV_USER" "$DEV_SSLMODE"
  else
    printf '%s database %s at %s:%s user %s sslmode=%s' "$target" "$PROD_DB" "$(mask_host "$PROD_HOST")" "$PROD_PORT" "$PROD_USER" "$PROD_SSLMODE"
  fi
}

sanitize_connection_output() {
  local target="$1"
  local output="$2"

  if [[ "$DB_AUDIT_MODE" == "direct" && "$target" == "dev" && -n "${DEV_HOST:-}" ]]; then
    output="${output//$DEV_HOST/$(mask_host "$DEV_HOST")}"
  elif [[ "$DB_AUDIT_MODE" == "direct" && "$target" == "prod" && -n "${PROD_HOST:-}" ]]; then
    output="${output//$PROD_HOST/$(mask_host "$PROD_HOST")}"
  fi

  printf '%s' "$output"
}

preflight_target() {
  local target="$1"
  local output

  if output="$(sql "$target" "select 1" 2>&1 >/dev/null)"; then
    echo "Connection OK: $(target_description "$target")"
    return
  fi

  echo "Connection FAILED: $(target_description "$target")" >&2
  if [[ -n "$output" ]]; then
    sanitize_connection_output "$target" "$output" >&2
    echo >&2
  fi
  exit 1
}

write_query_output() {
  local db="$1"
  local query="$2"
  local file="$3"

  sql "$db" "$query" > "$file"
}

run_query_list() {
  local db="$1"
  local list_query="$2"
  local file="$3"
  local queries

  queries="$(sql "$db" "$list_query")"
  while IFS= read -r query; do
    [[ -z "$query" ]] && continue
    sql "$db" "$query"
  done <<< "$queries" | sort > "$file"
}

TABLE_SQL="
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name <> all(${EXCLUDED_TABLES_SQL})
order by table_name"

COLUMN_SQL="
select
  table_name,
  ordinal_position,
  column_name,
  is_nullable,
  data_type,
  udt_name,
  coalesce(character_maximum_length::text, ''),
  coalesce(numeric_precision::text, ''),
  coalesce(numeric_scale::text, ''),
  coalesce(column_default, '')
from information_schema.columns
where table_schema = 'public'
  and table_name <> all(${EXCLUDED_TABLES_SQL})
order by table_name, ordinal_position"

CONSTRAINT_SQL="
select
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  kcu.ordinal_position,
  kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
 and tc.table_name = kcu.table_name
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
  and tc.table_name <> all(${EXCLUDED_TABLES_SQL})
order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position"

NO_PK_SQL="
select t.table_name
from information_schema.tables t
left join information_schema.table_constraints tc
  on tc.table_schema = t.table_schema
 and tc.table_name = t.table_name
 and tc.constraint_type = 'PRIMARY KEY'
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and tc.constraint_name is null
  and t.table_name <> all(${EXCLUDED_TABLES_SQL})
order by t.table_name"

COUNT_QUERY_SQL="
select format(
  'select %L as table_name, count(*)::bigint as row_count from public.%I',
  table_name,
  table_name
)
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name <> all(${EXCLUDED_TABLES_SQL})
order by table_name"

HASH_QUERY_SQL="
with pk as (
  select
    tc.table_name,
    kcu.column_name,
    kcu.ordinal_position
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_schema = kcu.constraint_schema
   and tc.constraint_name = kcu.constraint_name
   and tc.table_name = kcu.table_name
  where tc.table_schema = 'public'
    and tc.constraint_type = 'PRIMARY KEY'
    and tc.table_name <> all(${EXCLUDED_TABLES_SQL})
),
pk_expr as (
  select
    table_name,
    string_agg(
      format('coalesce(t.%I::text, %L)', column_name, '<NULL>'),
      ', '
      order by ordinal_position
    ) as pk_columns
  from pk
  group by table_name
)
select format(
  'select %L as table_name, concat_ws(%L, %s) as primary_key, md5(to_jsonb(t)::text) as row_hash from public.%I t',
  table_name,
  '|',
  pk_columns,
  table_name
)
from pk_expr
order by table_name"

IDENT_SQL="select current_database(), current_user, coalesce(inet_server_addr()::text, ''), inet_server_port()"

echo "Writing read-only DB audit to: $OUT_DIR"
echo "Mode: $DB_AUDIT_MODE"
echo "Development: $(target_description dev)"
echo "Production: $(target_description prod)"
if [[ -n "$AUDIT_EXCLUDE_TABLES_NORMALIZED" ]]; then
  echo "Excluded tables: $AUDIT_EXCLUDE_TABLES_NORMALIZED"
else
  echo "Excluded tables: none"
fi
echo

preflight_target dev
preflight_target prod
echo

write_query_output dev "$IDENT_SQL" "$OUT_DIR/dev_identity.tsv"
write_query_output prod "$IDENT_SQL" "$OUT_DIR/prod_identity.tsv"

write_query_output dev "$TABLE_SQL" "$OUT_DIR/dev_tables.tsv"
write_query_output prod "$TABLE_SQL" "$OUT_DIR/prod_tables.tsv"
write_query_output dev "$COLUMN_SQL" "$OUT_DIR/dev_columns.tsv"
write_query_output prod "$COLUMN_SQL" "$OUT_DIR/prod_columns.tsv"
write_query_output dev "$CONSTRAINT_SQL" "$OUT_DIR/dev_constraints.tsv"
write_query_output prod "$CONSTRAINT_SQL" "$OUT_DIR/prod_constraints.tsv"
write_query_output dev "$NO_PK_SQL" "$OUT_DIR/dev_tables_without_primary_key.tsv"
write_query_output prod "$NO_PK_SQL" "$OUT_DIR/prod_tables_without_primary_key.tsv"

run_query_list dev "$COUNT_QUERY_SQL" "$OUT_DIR/dev_counts.tsv"
run_query_list prod "$COUNT_QUERY_SQL" "$OUT_DIR/prod_counts.tsv"
run_query_list dev "$HASH_QUERY_SQL" "$OUT_DIR/dev_hashes.tsv"
run_query_list prod "$HASH_QUERY_SQL" "$OUT_DIR/prod_hashes.tsv"

diff -u "$OUT_DIR/dev_tables.tsv" "$OUT_DIR/prod_tables.tsv" > "$OUT_DIR/table_diff.patch" || true
diff -u "$OUT_DIR/dev_columns.tsv" "$OUT_DIR/prod_columns.tsv" > "$OUT_DIR/column_diff.patch" || true
diff -u "$OUT_DIR/dev_constraints.tsv" "$OUT_DIR/prod_constraints.tsv" > "$OUT_DIR/constraint_diff.patch" || true
diff -u "$OUT_DIR/dev_counts.tsv" "$OUT_DIR/prod_counts.tsv" > "$OUT_DIR/count_diff.patch" || true

awk -F'\t' '
  NR == FNR {
    dev[$1 FS $2] = $3
    next
  }
  {
    key = $1 FS $2
    if (!(key in dev)) {
      print "prod_only\t" $1 "\t" $2
    } else if (dev[key] != $3) {
      print "conflict\t" $1 "\t" $2
    }
  }
' "$OUT_DIR/dev_hashes.tsv" "$OUT_DIR/prod_hashes.tsv" > "$OUT_DIR/row_diff_details.tsv"

awk -F'\t' '
  NR == FNR {
    prod[$1 FS $2] = 1
    next
  }
  {
    key = $1 FS $2
    if (!(key in prod)) {
      print "dev_only\t" $1 "\t" $2
    }
  }
' "$OUT_DIR/prod_hashes.tsv" "$OUT_DIR/dev_hashes.tsv" >> "$OUT_DIR/row_diff_details.tsv"

awk -F'\t' '
  {
    count[$1 FS $2]++
  }
  END {
    for (key in count) {
      print key "\t" count[key]
    }
  }
' "$OUT_DIR/row_diff_details.tsv" | sort > "$OUT_DIR/row_diff_summary.tsv"

print_diff() {
  local title="$1"
  local file="$2"

  echo "== $title =="
  if [[ -s "$file" ]]; then
    cat "$file"
  else
    echo "No differences."
  fi
  echo
}

print_diff "TABLE DIFF" "$OUT_DIR/table_diff.patch"
print_diff "COLUMN DIFF" "$OUT_DIR/column_diff.patch"
print_diff "CONSTRAINT DIFF" "$OUT_DIR/constraint_diff.patch"
print_diff "ROW COUNT DIFF" "$OUT_DIR/count_diff.patch"

echo "== TABLES WITHOUT PRIMARY KEY =="
echo "Development:"
if [[ -s "$OUT_DIR/dev_tables_without_primary_key.tsv" ]]; then
  cat "$OUT_DIR/dev_tables_without_primary_key.tsv"
else
  echo "None."
fi
echo "Production:"
if [[ -s "$OUT_DIR/prod_tables_without_primary_key.tsv" ]]; then
  cat "$OUT_DIR/prod_tables_without_primary_key.tsv"
else
  echo "None."
fi
echo

echo "== ROW CONFLICT SUMMARY =="
if [[ -s "$OUT_DIR/row_diff_summary.tsv" ]]; then
  cat "$OUT_DIR/row_diff_summary.tsv"
else
  echo "No row-level primary-key differences found."
fi
echo

echo "Details saved in: $OUT_DIR"
