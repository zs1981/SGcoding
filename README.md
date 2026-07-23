# SGcoding

SGcoding 是一个用于构建 AI Coding Agent 核心流程的 TypeScript CLI 项目。项目参考 opencode 的部分概念，以较小的代码规模练习命令行解析、Session 持久化、事件记录、数据库投影和模型调用。

## 当前能力

- 使用 Commander 解析 `create`、`delete`、`archive` 和 `chat` 命令。
- 使用 SQLite、better-sqlite3 和 Drizzle ORM 保存 Session 与消息。
- 通过 EventService 和 SessionProjector 记录事件并更新查询表。
- 通过 OpenAI SDK 兼容接口调用 Ark 模型。
- 使用 TypeScript、NodeNext 和 ESM。

## 安装

```powershell
npm install
```

在项目根目录创建 `.env`：

```dotenv
ARK_API_KEY=你的_API_Key
```

`.env` 已被 Git 忽略，不要把 API Key 提交到仓库。目前只支持ark火山模型。
## 初始化数据库

先编译项目：

```powershell
npm run build
```

再执行数据库迁移：

```powershell
node .\dist\database\migrate.js
```

数据库文件会创建在 `data/sgcoding.db`。`data/` 属于本地运行数据，不会提交到 Git。

## 开发运行

查看帮助：

```powershell
npm run dev -- --help
```

创建 Session：

```powershell
npm run dev -- create 我的第一个会话
```

与模型对话：

```powershell
npm run dev -- chat --session <session-id> --model <model-id> hello world
```

归档或删除 Session：

```powershell
npm run dev -- archive <session-id>
npm run dev -- delete <session-id>
```

## 全局命令

编译并链接当前项目：

```powershell
npm run build
npm link
```

之后可以直接使用：

```powershell
sgcoding --help
```

## 检查与构建

只检查 TypeScript 类型，不生成文件：

```powershell
npm run typecheck
```

编译到 `dist/`：

```powershell
npm run build
```

`dist/` 是可重新生成的构建产物，已被 Git 忽略。

## 目录结构

```text
src/
├─ command/        CLI 命令处理
├─ database/       数据库连接、Schema 和迁移入口
├─ event/          事件类型与事件发布
├─ session/        Session 服务、查询和投影
├─ cliArgs.ts      Commander 参数解析
├─ index.ts        CLI 入口与命令分发
├─ model.ts        模型调用边界
└─ runtime.ts      运行时依赖组装

drizzle/           数据库迁移文件
data/              本地数据库文件，不提交
dist/              TypeScript 编译结果，不提交
```

## 项目状态

这是一个学习中的项目，接口和目录结构仍可能随着后续功能调整。提交代码前至少运行：

```powershell
npm run typecheck
npm run build
```
