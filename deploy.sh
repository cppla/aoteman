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

# Compose also reads .env. Resolve its values before validating a volume or
# exporting a default, so the safety checks inspect the actual deployment.
compose_environment=$(docker compose config --environment)
compose_setting() {
  printf '%s\n' "$compose_environment" | awk -v setting="$1" 'index($0, setting "=") == 1 { print substr($0, length(setting) + 2); exit }'
}
PORT=$(compose_setting PORT)
PORT=${PORT:-8787}
data_volume=$(compose_setting AOTEMAN_VOLUME_NAME)
data_volume=${data_volume:-aoteman_data}
compose_project=$(compose_setting COMPOSE_PROJECT_NAME)
compose_project=${compose_project:-aoteman}
unset compose_environment
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
AOTEMAN_VOLUME_NAME=$data_volume
COMPOSE_PROJECT_NAME=$compose_project
export AOTEMAN_VOLUME_NAME COMPOSE_PROJECT_NAME

docker compose config --quiet

# A fixed volume name prevents a renamed checkout from silently creating an
# empty save store. Refuse to adopt another application's volume by accident.
has_data_volume=false
if docker volume inspect "$data_volume" >/dev/null 2>&1; then
  has_data_volume=true
  volume_project=$(docker volume inspect "$data_volume" --format '{{index .Labels "com.docker.compose.project"}}')
  volume_key=$(docker volume inspect "$data_volume" --format '{{index .Labels "com.docker.compose.volume"}}')
  if [ "$volume_project" != "$compose_project" ] || [ "$volume_key" != data ]; then
    printf '发现已有 %s 数据卷，但不属于本项目。为避免使用错误存档，本次部署已停止；请先核对数据卷。\n' "$data_volume" >&2
    exit 1
  fi
fi

backup_path="/data/backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).sqlite3"
api_id=$(docker compose ps --all --quiet api)
if [ -n "$api_id" ]; then
  mounted_volume=$(docker inspect "$api_id" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')
  if [ "$mounted_volume" != "$data_volume" ]; then
    printf '现有 API 使用的数据卷 %s 与本次配置 %s 不一致，已停止部署并保留原存档。请核对 AOTEMAN_VOLUME_NAME 与 .env 配置。\n' "$mounted_volume" "$data_volume" >&2
    exit 1
  fi
  api_health=$(docker inspect "$api_id" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')
  api_running=$(docker inspect "$api_id" --format '{{.State.Running}}')
  if [ "$api_running" != true ] || [ "$api_health" != healthy ]; then
    printf '%s\n' '已有 API 容器未处于 healthy 状态。本次部署已停止，原容器和数据卷均保留。请先查看 docker compose logs --tail=100 api 并检查存档。' >&2
    exit 1
  fi
  printf '%s\n' '正在创建升级前 SQLite 一致性快照……'
  docker compose exec -T api python -m server.backup --output "$backup_path"
elif [ "$has_data_volume" = true ]; then
  # After `compose down`, use the previously built API image to back up before
  # building or running the new version against the existing database.
  if ! docker image inspect aoteman-api:local >/dev/null 2>&1; then
    printf '%s\n' '已有成长数据卷，但找不到上一版 API 镜像，无法执行升级前备份。本次部署已停止；请先按 README 导出并核对存档。' >&2
    exit 1
  fi
  printf '%s\n' '正在为已停止的服务创建升级前 SQLite 一致性快照……'
  docker compose run --rm --no-deps -T api python -m server.backup --output "$backup_path"
fi

docker compose up -d --build --wait --wait-timeout 120

printf '\n%s\n' '奥特曼电子宠物已启动，健康检查通过。'
printf '本机试玩：http://localhost:%s\n' "$PORT"
printf '服务器试玩：http://<服务器 IP>:%s\n' "$PORT"
printf '存档持久化：%s 数据卷 /data/aoteman.sqlite3\n' "$data_volume"
printf '%s\n' '查看状态：docker compose ps' '查看日志：docker compose logs --tail=100 web api' '导出数据库备份：./scripts/backup.sh'
