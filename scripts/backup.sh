#!/bin/sh
# Export a consistent SQLite snapshot, without copying a live WAL database.
set -eu
umask 077

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ "$#" -gt 1 ]; then
  printf '%s\n' '用法：./scripts/backup.sh [主机备份文件.sqlite3]' >&2
  exit 1
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
destination=${1:-"backups/aoteman-$stamp.sqlite3"}
case "$destination" in
  /*) ;;
  *) destination="$PWD/$destination" ;;
esac
case "$destination" in
  *.sqlite3) ;;
  *) printf '%s\n' '备份文件名必须以 .sqlite3 结尾。' >&2; exit 1 ;;
esac
if [ -e "$destination" ]; then
  printf '%s\n' "备份目标已存在，未覆盖：$destination" >&2
  exit 1
fi

api_id=$(docker compose ps --quiet api)
if [ -z "$api_id" ]; then
  printf '%s\n' 'API 未运行。请先启动服务；离线恢复方法见 README。' >&2
  exit 1
fi

container_snapshot="/data/backups/export-$stamp.sqlite3"
docker compose exec -T api python -m server.backup --output "$container_snapshot"

mkdir -p "$(dirname -- "$destination")"
temporary=$(mktemp "${destination}.tmp.XXXXXX")
trap 'rm -f -- "$temporary"' EXIT HUP INT TERM
docker cp "$api_id:$container_snapshot" "$temporary"
chmod 600 "$temporary"
mv -n -- "$temporary" "$destination"
if [ -e "$temporary" ]; then
  printf '备份目标已被创建，未覆盖：%s\n' "$destination" >&2
  exit 1
fi
trap - EXIT HUP INT TERM

if command -v shasum >/dev/null 2>&1; then
  LC_ALL=C LANG=C shasum -a 256 "$destination" > "$destination.sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  LC_ALL=C LANG=C sha256sum "$destination" > "$destination.sha256"
else
  printf '%s\n' '备份已导出，但未找到 shasum / sha256sum，未生成校验文件。' >&2
fi

printf 'SQLite 备份已导出：%s\n' "$destination"
if [ -f "$destination.sha256" ]; then
  printf 'SHA-256 校验：%s\n' "$destination.sha256"
fi
