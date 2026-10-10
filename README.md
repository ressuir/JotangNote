# JotangNote

焦糖工作室 2026 后端招新项目。Java 17 + Spring Boot + MyBatis-Plus + MySQL + Redis + RabbitMQ + DeepSeek API，带一个可以实际使用的网页前端。

## 已实现功能

- 注册、登录、退出，基于 HTTP Session
- 我的笔记：创建、列出、查看、修改、删除
- 后端校验笔记作者身份，用户只能读取和修改自己的笔记
- Redis 缓存单篇笔记，按用户隔离缓存键
- RabbitMQ 异步处理笔记增删改，接口返回 HTTP 202（已经入队，而非完成）
- AI 助手的多轮历史与 `get_note` Tool Use，工具只能读取当前用户的笔记
- 浏览器登录、笔记编辑和 AI 聊天界面

这是本地开发和招新展示项目，**不是生产环境部署方案**。

## 如何运行

依赖 JDK 17、MySQL 8+、Redis、RabbitMQ。第一次建表：

```bash
mysql -u root -p < sql/schema.sql
```

为运行应用的 MySQL 账号授予 `jotang_note` 的读写权限。启动三个依赖服务，在启动 Spring Boot 的**同一个终端**设置环境变量：

```bash
export DB_USERNAME='你的MySQL用户名'
export DB_PASSWORD='你的MySQL密码'
export DEEPSEEK_API_KEY='你的DeepSeek API Key' # 仅测试在线 AI 时需要
./mvnw spring-boot:run
```

浏览器打开 **http://localhost:8080/**。不设置 AI Key 也可以运行其他功能。

已有旧数据库时，`CREATE TABLE IF NOT EXISTS` 不会替换旧表结构。需要先备份，再用 `SHOW CREATE TABLE users;` 和 `SHOW CREATE TABLE notes;` 核对字段。

## 接口

| 操作 | HTTP 接口 | 说明 |
| --- | --- | --- |
| 注册 | `POST /api/auth/register` | username 2–32 字符，password 8–72 UTF-8 字节 |
| 登录 | `POST /api/auth/login` | 成功后用 Cookie 保存 Session |
| 当前用户 | `GET /api/auth/me` | 需登录 |
| 退出 | `POST /api/auth/logout` | 销毁 Session |
| 我的笔记 | `GET /api/notes` | 只返回当前用户的笔记 |
| 查看笔记 | `GET /api/notes/{id}` | 只能读取自己的笔记 |
| 创建笔记 | `POST /api/notes` | `{"title":"标题","content":"正文"}`；返回 202 |
| 修改笔记 | `PUT /api/notes/{id}` | 返回 202 |
| 删除笔记 | `DELETE /api/notes/{id}` | 返回 202 |
| AI 对话 | `POST /chat` | `{"message":"总结 1 号笔记"}` |
| 新 AI 会话 | `DELETE /chat` | 清理当前会话 |

## 自动化测试与运行证据

有 MySQL/Redis/RabbitMQ 服务与数据库环境变量时：

```bash
./mvnw test
bash scripts/smoke-test.sh
```

`smoke-test.sh` 需要 `curl`、`jq` 和 `redis-cli`，并检验真实注册登录、跨用户隔离、Redis 实际缓存键和 TTL、RabbitMQ 增删改及缓存清理。

[GitHub Actions](https://github.com/ressuir/JotangNote/actions) 在 CI 环境自动启动 MySQL、Redis、RabbitMQ 进行测试。成功的流水线还会用 Chromium 自动注册、登录、创建笔记并生成真实浏览器截图及运行日志可视化：

- [注册登录页面](Notes/screenshots/01-login.png)
- [笔记创建页面](Notes/screenshots/02-notes.png)
- [AI 界面（仅界面验证）](Notes/screenshots/03-ai-ui.png)
- [真实 CI 冒烟与 RabbitMQ 日志](Notes/screenshots/04-verified-ci-log.png)

**证据范围：** CI 不调用收费的 DeepSeek API。AI 工具分发和权限有单元测试，但真实模型回复、多轮远程调用和模型自主 Tool Use 不能仅凭这些测试认定通过。原始运行日志可以从相应 Actions 页面下载 artifact 查看。

## 三篇招新文档

- [启蒙篇](Notes/启蒙篇.md)
- [入门篇](Notes/入门篇.md)
- [进阶篇](Notes/进阶篇.md)

## 当前限制

MQ 没有完整实现消息幂等、死信队列、持久化操作状态查询；AI 历史存在内存中，重启后丢失。当前不提供图片/附件上传、笔记评论、生产 HTTPS 部署等扩展功能。凭证、API Key 和 Cookie 不应加入 Git 仓库。
