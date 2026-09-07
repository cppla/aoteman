#!/bin/sh
# Restore while the API is stopped; the backend additionally holds an OS lock.
set -eu
umask 077

if [ "$#" -ne 1 ]; then
  printf '%s\n' '用法：./scripts/restore.sh /绝对路径/备份.sqlite3' >&2
  exit 1
fi

snapshot=$1
case "$snapshot" in
  /*) ;;
  *) snapshot="$PWD/$snapshot" ;;
esac
if [ ! -f "$snapshot" ] || [ ! -r "$snapshot" ]; then
  printf '无法读取备份文件：%s\n' "$snapshot" >&2
  exit 1
fi

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

api_id=$(docker compose ps --quiet api)
if [ -n "$api_id" ]; then
  printf '%s\n' 'API 仍在运行，未执行恢复。请先运行 docker compose stop web api，再重新执行恢复。' >&2
  exit 1
fi

# Stdin keeps host snapshots private even when their UID differs from the API.
docker compose run --rm --no-deps -T api sh -c '
  set -eu
  umask 077
  mkdir -p /data/backups
  incoming=$(mktemp /data/backups/restore-import.XXXXXX)
  cat > "$incoming"
  python -m server.restore "$incoming"
' < "$snapshot"

printf '%s\n' '恢复完成。请运行 docker compose up -d --wait 启动服务，然后使用原恢复码核对成长进度。'
