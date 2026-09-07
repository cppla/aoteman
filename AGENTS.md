# 项目协作约定

用户已明确指定：后续若无特殊说明，本项目每轮更新完成后，默认执行以下交付流程，无需重复询问是否推送或部署：

1. 完成相关验证，提交修改并推送 GitHub `cppla/aoteman` 的 `main` 分支；核对 GitHub 上的完整提交 SHA 与本次待部署版本一致。
2. 以 Docker 方式部署或更新到 `alisg.cloudcpp.com`，服务器项目目录为 `/data/aoteman`，Compose 项目名为 `aoteman`。

本机已配置 SSH 别名 `alisg-cloudcpp`，对应 `root@alisg.cloudcpp.com:24`。其他机器应使用自己的授权连接方式；不要把密钥、密码或恢复码写入仓库。

- 部署前核对目标主机、Git 分支和工作区，保留非本次任务的改动。服务器有未提交修改或不能快进时，先查明差异。
- 只更新服务器 `/data/aoteman` 部署目录，不覆盖其他克隆或现有工作区。通常使用 `git pull --ff-only origin main`，然后核对远端 HEAD 等于已推送的目标 SHA，再运行部署。
- 若服务器暂时无法访问 GitHub，可在本机为已推送的 `main` 创建 Git bundle，经 SSH 传到服务器；验证 bundle，获取其中的 `main`，核对其 SHA 后仅快进更新。首次 clone 只允许使用不存在的目标目录，`origin` 仍指向 GitHub。恢复网络后继续正常 Git 更新；不要把一次连接失败当作长期不可访问。
- 服务器使用固定数据卷 `aoteman_data`，通过 `./deploy.sh` 先创建 SQLite 一致性备份再升级；备份失败或已有服务异常时，先排查，不跳过保护。
- 首次部署在确认服务器没有已有存档后可导入本地一致性快照；后续更新以服务器成长库为准，不用本地旧库或 GitHub 空模板覆盖。
- 不删除成长数据卷，不执行 `docker compose down -v`。运行库、WAL、备份及玩家恢复身份均不得提交 Git。
- 部署后核对远端 Git SHA、Web/API 健康状态、公开入口与 SQLite 数据保留情况，再报告结果。只操作本项目，不改动服务器上的其他服务。
