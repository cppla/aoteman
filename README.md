# 银河小伙伴 · 奥特曼电子宠物

一个可以陪伴、养成和战斗的奥特曼电子宠物。浏览器直接游玩，原生 JavaScript ES Modules + SVG / CSS 动画，无需 Node.js 服务、数据库或外部素材接口。

![星光基地](docs/screenshots/base.png)

![交叉双臂的 X 防御](docs/screenshots/battle.png)

## 玩法

- **陪伴养成**：喂食、抚摸、休息与特训会影响饱食度、活力和心情；升级、出击、完成每日计划可积累成长与星光奖励。
- **自己的小宇宙**：使用星光解锁商店场景，收集怪兽图鉴，查看伙伴的成长记录。
- **动态战斗**：奥特曼和怪兽都有待机、攻击、受击和行动动画，战斗中可观察怪兽的攻击预警。
- **真正的 X 防御**：防御时双臂交叉在胸前，普通防御减伤 90%；抓准攻击落点完成完美防御，可免受该次伤害。
- **技能快捷键**：数字 **1–5** 对应战斗技能，按界面提示切换进攻、防御与闪避，**P** 暂停；也可以直接点击或触摸按钮。
- **浏览器存档**：成长数据自动保存在当前浏览器，可通过界面导出 JSON 存档，再导入到其他浏览器继续玩；同源的旧版 v1 存档可自动迁移。存档在本机浏览器中，不会自动同步到服务器；更换网址、端口、浏览器或清除网站数据后需要重新导入。

## 本地一键试玩

先安装并启动 Docker（macOS / Windows 可使用 Docker Desktop；Linux 使用 Docker Engine 和 Compose 插件），在项目目录运行：

```sh
./deploy.sh
```

脚本会检查 Docker、构建镜像、启动服务并等待健康检查通过。打开 **http://localhost:8787** 开始试玩。

端口被占用时，可改用其他端口：

```sh
PORT=8888 ./deploy.sh
```

## 服务器部署

```sh
git clone https://github.com/cppla/aoteman.git aoteman
cd aoteman
docker compose up -d --build
```

访问 `http://<服务器 IP>:8787`。也可运行 `./deploy.sh`，额外等待健康检查并显示访问地址。

默认映射 `8787 → 容器 8080`，可通过 `PORT` 改端口：

```sh
PORT=8888 docker compose up -d --build
```

需在云安全组及服务器防火墙中允许所选 TCP 端口。使用域名和 HTTPS 时，可让已有反向代理转发到此端口。公开服务器只能分发网页，存档仍由各浏览器分别保管。

更新代码后，在项目目录再次运行：

```sh
git pull
./deploy.sh
```

## 容器管理

```sh
# 服务及健康状态
docker compose ps

# 最近的访问 / 错误日志
docker compose logs --tail=100 web

# 检查 HTTP 服务
curl -fsS http://localhost:8787/healthz

# 停止当前项目服务
docker compose down
```

镜像使用 [官方 Nginx Alpine 稳定版](https://hub.docker.com/_/nginx) `1.30.4-alpine`。Nginx 以非 root 用户在 `8080` 端口运行，根文件系统只读，临时文件写入 `/tmp` 内存目录。日志自动轮转，服务配置 `restart: unless-stopped`；镜像内置 `/healthz` 健康检查。部署脚本不会清理其他 Docker 镜像、容器或数据。

## 开发与验证

网页源码位于 `public/`。修改后重新运行 `./deploy.sh` 即可更新容器；也可用静态 HTTP 服务预览该目录。ES Modules 需要通过 HTTP 打开，不要直接双击 `index.html`。

配置检查：

```sh
docker compose config --quiet
sh -n deploy.sh

# 有 Node.js 20+ 的开发环境下运行纯逻辑回归测试
npm test
```

浏览器回归测试（先启动本地容器）：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:browser
# 测试其他 HTTP 地址：BASE_URL=http://localhost:8888 pnpm test:browser
```

Playwright 仅用于开发验证，不会进入网页或 Docker 运行镜像。截图和临时存档写入被 Git 忽略的 `test-results/`。

浏览器手工验收建议：

1. 在桌面和手机尺寸检查布局、触摸操作、奥特曼及怪兽动画。
2. 进入战斗，验证数字 1–5、攻击提示、双臂 X 防御、普通减伤和完美防御。
3. 进行养成操作，刷新页面检查进度保留；导出后导入，核对进度一致。
4. 检查后台切换、静音以及重新开始等边界流程，确认无浏览器控制台错误。

自动测试及本机验收结果以项目内测试文件和实际运行记录为准；上述检查清单不代表已经完成服务器生产环境验证。

2026-09-07 本机验收：18 项养成与战斗逻辑测试通过；Chromium 桌面和 375 / 430 / 768px 布局、触摸战斗、减少动态效果、跨标签存档同步、JSON 导入导出通过，未发现页面异常或 HTTP 失败。实际键盘通关并验证胜利界面直接刷新保留奖励。本地 Docker 容器 `/healthz` 返回 200，状态 healthy。尚未部署到远程服务器。

## 说明

这是非商业同人练习项目，与奥特曼官方无隶属或授权关系。相关角色名称与原作权利归各自权利人所有。请勿将本项目用于冒充官方、商业售卖或侵权传播。代码许可见 [LICENSE](LICENSE)。
