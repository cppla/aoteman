#!/bin/sh
set -eu

cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' '未找到 Docker。请先安装 Docker Engine 和 Docker Compose 插件；macOS 可启动 Docker Desktop。' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' '未找到 docker compose。请安装或更新 Docker Compose 插件。' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf '%s\n' '无法连接 Docker。请先启动 Docker，并确认当前用户拥有访问权限。' >&2
  exit 1
fi

PORT=${PORT:-8787}
case "$PORT" in
  *[!0-9]*|'')
    printf '%s\n' 'PORT 必须是 1 到 65535 的整数。' >&2
    exit 1
    ;;
esac
if [ "${#PORT}" -gt 5 ] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  printf '%s\n' 'PORT 必须是 1 到 65535 的整数。' >&2
  exit 1
fi
export PORT

docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 60

printf '\n%s\n' '奥特曼电子宠物已启动，健康检查通过。'
printf '本机试玩：http://localhost:%s\n' "$PORT"
printf '服务器试玩：http://<服务器 IP>:%s\n' "$PORT"
printf '%s\n' '查看状态：docker compose ps' '查看日志：docker compose logs --tail=100 web'
