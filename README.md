# 焦糖笔记 JotangNote

基于 Java 17、Spring Boot 4.1.1、MyBatis-Plus 3.5.17、MySQL、Redis 和 RabbitMQ 的个人笔记应用。网页由 Spring Boot 直接提供，包含注册登录、笔记管理和 DeepSeek AI 助手。

## 快速运行

安装 Docker Engine 与 Docker Compose v2，或带 Compose 的 Docker Desktop。首次启动需要联网拉取容器镜像和 Maven 依赖。无需在宿主机安装 Java、MySQL、Redis 或 RabbitMQ。

在含 `compose.yaml` 的项目根目录执行：

```bash
cp .env.example .env
# Windows PowerShell：Copy-Item .env.example .env
# 可选：编辑 .env，设置 DEEPSEEK_API_KEY

docker compose up --build -d
docker compose ps
docker compose logs -f app
```

看到 `Started JotangNoteApplication` 后，浏览器打开 **http://localhost:8080/**，注册一个账号，再登录创建笔记。首轮构建需要下载依赖，请等待日志中的启动完成信息。AI Key 留空时，账号和笔记仍可使用；AI 会显示配置提示。

停止服务：`docker compose down`。命名数据卷会保留。需要彻底重建数据库时才使用 `docker compose down -v`，该命令会删除该 Compose 实例的数据库与中间件数据。

端口冲突时修改 `.env` 的 `APP_PORT`，例如改为 `8081` 后访问 http://localhost:8081/。MySQL、Redis、RabbitMQ 只在容器网络中连接，默认不向宿主机映射端口。网页端口仅绑定宿主机 127.0.0.1。

## 实际功能

- 注册、登录、当前用户查询及退出；Session 保持身份，BCrypt 保存密码哈希。
- 本人笔记的创建、列表、详情、修改及删除；后端校验数据归属。
- 网页按标题或正文筛选已加载列表，支持最近修改或最新创建排序。
- 单篇笔记 Redis 缓存：`note:<userId>:<noteId>`，TTL 为 600 秒；读取缓存失败时回退 MySQL。
- RabbitMQ 异步增删改：HTTP 202 表示操作入队；前端轮询实际数据后才确认保存。
- AI 普通对话、多轮消息历史、清空当前会话及 `get_note` 工具；工具只能读取当前用户笔记。

## 配置说明

`.env.example` 中的密码仅为独立课程演示的公开默认值，不是个人账号密码。需要其他部署用途时请自行设置。

| 变量 | 作用 |
| --- | --- |
| APP_PORT | 宿主机网页端口，默认 8080 |
| MYSQL_ROOT_PASSWORD | MySQL 初始化管理员密码 |
| DB_USERNAME / DB_PASSWORD | 应用的 MySQL 账号与密码 |
| RABBITMQ_USERNAME / RABBITMQ_PASSWORD | RabbitMQ 账号与密码 |
| DEEPSEEK_API_KEY | 可选的服务端 API Key，勿提交到 Git |
| DEEPSEEK_BASE_URL | 默认 https://api.deepseek.com |
| DEEPSEEK_MODEL | 默认 deepseek-flash，可按账号权限调整 |

修改 AI 环境变量后执行 `docker compose up -d --force-recreate app`。密钥无效、余额不足或限流时，服务返回 503 与中文提示。仅修改 `.env` 中数据库密码不会更新已有数据卷内的数据库账号；已有数据需要先备份并在数据库中修改对应账号。

## 数据库初始化

`sql/schema.sql` 创建 `jotang_note` 数据库及 `users`、`notes` 两张表，含用户名唯一键、作者索引和作者外键。Compose 在 MySQL 数据卷首次初始化时自动执行。

`CREATE TABLE IF NOT EXISTS` 不迁移旧表。已有数据库应先备份，再比较实际表结构。直接安装服务时可运行：

```bash
mysql -u root -p < sql/schema.sql
```

## 直接使用 Java 运行

需要 JDK 17，以及能在 localhost 访问的 MySQL 8+、Redis、RabbitMQ。数据库初始化后，在启动应用的同一个终端设置：

```bash
export DB_USERNAME='你的数据库账号'
export DB_PASSWORD='你的数据库密码'
export SPRING_RABBITMQ_USERNAME='你的消息队列账号'
export SPRING_RABBITMQ_PASSWORD='你的消息队列密码'
export DEEPSEEK_API_KEY='你的密钥' # 可选
bash mvnw verify
bash mvnw spring-boot:run
```

可使用 Spring 标准环境变量 `SPRING_DATASOURCE_URL`、`SPRING_DATA_REDIS_HOST`、`SPRING_RABBITMQ_HOST` 调整服务地址。Windows 使用 `mvnw.cmd`，并用 PowerShell 的 `$env:变量名='值'` 设置变量。

## API

| 操作 | 接口 | 实际语义 |
| --- | --- | --- |
| 注册 | POST /api/auth/register | username、password；用户名重复为 409 |
| 登录 | POST /api/auth/login | 浏览器保存 Session Cookie |
| 当前用户 / 退出 | GET /api/auth/me / POST /api/auth/logout | 退出销毁 Session |
| 本人列表 / 详情 | GET /api/notes / GET /api/notes/{id} | 匿名 401；他人笔记 404 |
| 创建 | POST /api/notes | title、content；返回 202 |
| 修改 / 删除 | PUT /api/notes/{id} / DELETE /api/notes/{id} | 返回 202 后查询实际结果 |
| AI 对话 / 清空 | POST /chat / DELETE /chat | message；AI 回复在 reply 字段 |

前端提交示例：`{"title":"学习笔记","content":"今天整理 Redis 缓存。"}`。创建时 authorId 来自 Session，不接受客户端指定作者。

## 测试与证据

GitHub Actions 在云端执行 Maven、真实 HTTP 与浏览器测试。`course/evidence/current.json` 记录运行编号、提交版本、Maven 数量和 AI 可用状态。当前验证包含普通 AI 回复、多轮随机词记忆、模型通过 get_note 读取数据库随机标识，以及第二个账号无法通过 AI 获取他人笔记。

直接运行的后端准备好后，可以执行 `bash scripts/smoke-test.sh`；宿主机需有 curl、jq 和 redis-cli。该脚本验证双用户隔离、MQ 异步 CRUD、Redis 实际键值与缓存失效。它默认连接 localhost:6379，因此不能直接对未映射 Redis 端口的 Compose 实例运行。Compose 专用测试使用 `python3 course/compose-smoke.py`，只需 Python 3 标准库，并通过 docker compose exec 检查 Redis。

在线测试脚本：`scripts/ai-live-test.cjs`，需要 Node.js、Playwright 和 Chromium；通过运行中的真实项目调用 DeepSeek，会消耗账号 API 额度。普通 Maven 单元测试不需要外部 AI。

## 源码与演示材料

- `src/main/java`：后端、鉴权、缓存、MQ 与 AI。
- `src/main/resources/static`：真实网页前端。
- `src/test/java`：应用上下文、数据归属和工具权限测试。
- `sql/schema.sql`：数据库初始化。
- `compose.yaml`、`Dockerfile`、`.env.example`：运行包装。
- `course/record-demo.cjs`、`course/finalize-video.py`：真实录制与字幕处理。
- 课程 ZIP 的 `演示视频` 目录包含 MP4 与 SRT，`项目报告` 和 `项目介绍` 包含正式文档。
- 源码包中的 `Git历史.bundle` 可用 `git clone Git历史.bundle JotangNote-history` 恢复带提交记录的仓库。

历史学习记录保存在 `Notes` 中，以当前源码及 `course/evidence` 的新测试记录为准。

## 当前边界

尚未完整实现 MQ 幂等、死信队列、持久化操作状态和并发缓存一致性；AI 历史与 Session 位于单实例内存。未实现附件、评论、协作编辑或生产 HTTPS 部署。当前测试未覆盖压力、故障恢复和集群场景。
