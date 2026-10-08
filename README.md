# JotangNote

焦糖工作室 2026 后端招新项目。Java 17 + Spring Boot + MyBatis-Plus + MySQL + Redis + RabbitMQ + DeepSeek API，附简易网页前端。

## 功能

- 注册、登录、退出，使用 HTTP Session
- 创建、列出、查看、修改、删除 Markdown 文本笔记
- 笔记只对登录的作者可见；其他人的笔记 ID 返回 404
- Redis 缓存单篇笔记，key 包含登录用户 ID
- RabbitMQ 异步处理笔记增删改，接口返回 HTTP 202（已入队，不表示已完成）
- AI 助手使用 `get_note` 工具读取**当前用户有权限查看**的笔记

> 本项目主要用于本地开发和招新展示，尚非生产部署方案。MQ 消费端尚未实现创建操作幂等、死信队列及持久化操作状态查询；网络断开或服务重启时可能出现重试/重复消费。

## 环境要求

- JDK 17、MySQL 8+、Redis、RabbitMQ
- Maven 使用仓库内的 Maven Wrapper；RabbitMQ 默认使用本机 5672 端口
- AI 功能需要 DeepSeek API Key；不使用 AI 时可以不配置 Key

## 初次初始化

1. 启动 MySQL、Redis、RabbitMQ。
2. 执行数据库建表文件（新数据库）：`mysql -u root -p < sql/schema.sql`。
3. 确保运行应用的 MySQL 账号对 `jotang_note` 数据库具有所需的读写权限。
4. 在**启动应用的同一个终端**设置环境变量：

```bash
export DB_USERNAME='你的MySQL用户名'
export DB_PASSWORD='你的MySQL密码'
export DEEPSEEK_API_KEY='你的DeepSeek API Key' # 仅调用 AI 时必需
./mvnw spring-boot:run
```

在浏览器打开 `http://localhost:8080/`。不要把密码、API Key、会话 Cookie 或真实 .env 文件提交到 Git。

**已有数据库注意：** `CREATE TABLE IF NOT EXISTS` 不会修改旧表的结构。旧环境请先备份，并核对 `SHOW CREATE TABLE users;`、`SHOW CREATE TABLE notes;`，尤其是用户名唯一索引及字段名称。如果数据库账号设置不正确，注册/登录会报错；请先排查 Hikari/MySQL 日志和环境变量，而不是直接把密码写死到配置文件。

## 主要接口

| 操作 | HTTP 接口 | 说明 |
| --- | --- | --- |
| 注册 | `POST /api/auth/register` | JSON: `{"username":"alice","password":"password123"}` |
| 登录 | `POST /api/auth/login` | 返回 Cookie Session |
| 当前用户 | `GET /api/auth/me` | 需登录 |
| 退出 | `POST /api/auth/logout` | 销毁 Session |
| 我的笔记 | `GET /api/notes` | 只返回当前用户笔记 |
| 查看笔记 | `GET /api/notes/{id}` | 只读自己的笔记 |
| 创建 | `POST /api/notes` | JSON: `{"title":"标题","content":"正文"}`；202 |
| 修改 | `PUT /api/notes/{id}` | 202 |
| 删除 | `DELETE /api/notes/{id}` | 202 |
| AI 对话 | `POST /chat` | JSON: `{"message":"总结 1 号笔记"}` |
| 清空 AI 对话 | `DELETE /chat` | 清除当前会话历史 |

## 测试与演示

```bash
./mvnw test
```

`JotangNoteApplicationTests` 是 Spring 上下文测试，需要按上述配置准备数据库及环境。权限相关的纯单元测试位于 `NoteAccessServiceTest`，可运行：

```bash
./mvnw -Dtest=NoteAccessServiceTest test
```

启动应用后，可用 `bash scripts/smoke-test.sh` 复查注册登录、双用户笔记隔离和 MQ 增删改。

提交前建议用两个新用户执行完整验收：A 创建笔记，B 的列表看不到，B 直接读取 A 的 ID 得到 404，B 用 AI 请求读取该 ID 也不能看到内容；A 能读取并修改、删除自己的笔记。反复保存和删除，确认 RabbitMQ 消费成功后页面状态正确。

## 作业资料

- [后端启蒙篇笔记](Notes/启蒙篇.md)

## 已知限制

- 新建、修改、删除是 MQ 异步写入：调用成功意味着入队，不是 MySQL 已落库；前端会轮询确认，超时后需要手动刷新
- RabbitMQ 尚未实现可靠消息确认、死信队列、消息幂等和操作状态查询
- AI 目前只有 `get_note` 工具；历史暂存在服务端内存，重启会清空
- 当前项目不提供附件上传、多设备共享会话、HTTPS 终止或正式生产环境部署
