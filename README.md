# SGcoding

SGcoding 是一个用于构建 AI Coding Agent 核心流程的 TypeScript CLI 项目。项目参考 opencode 的部分概念，以较小的代码规模练习命令行解析、Session 持久化、事件记录、数据库投影和模型调用。

## 当前能力

- 使用 Commander 解析 `run` 以及 `session list`、`session archive`、`session unarchive`、`session delete` 命令。
- `session list` 支持限制数量、表格/JSON 格式和查询已归档 Session。
- 使用 SQLite、better-sqlite3 和 Drizzle ORM 保存 Session 与消息。
- 通过 EventService 和 SessionProjector 记录事件并更新查询表。
- 模型层使用 AI SDK 和 `@ai-sdk/openai`，按 `provider/model` 格式选择模型，并包含 Ark Responses 请求适配。
- 支持通过运行时参数注入数据库路径和模型调用函数。
- 使用 TypeScript、NodeNext 和 ESM。

## 当前运行状态

当前 `src/index.ts` 中的 CLI 入口仍使用测试配置：

```ts
const runtime = createRuntime({
    databasePath: ":memory:",
    askModel: async () => "pong"
});
```

因此，直接运行 `run` 会固定回复 `pong`，不发送真实模型请求；每次启动都会创建独立的内存数据库，进程结束后会话不保留。下一次运行 `session list` 无法看到上一次创建的会话，`--session` 也无法跨进程续聊。

下面的快速体验适用于当前代码。后续的真实模型、数据库文件和会话管理用法，需要先按“启用真实模型与持久化存储”一节调整入口。

## 安装

```powershell
npm install
```

以下命令默认在项目根目录执行。

无需 API Key 即可体验当前测试配置：

```powershell
npm run dev -- run "你好"
```

成功时会输出 `Session: ses_...` 和 `pong`。Session ID 写入标准错误流，回复写入标准输出流。

## 启用真实模型与持久化存储

将 `src/index.ts` 中上面的 `createRuntime({...})` 改为：

```ts
const runtime = createRuntime();
```

这样会使用实际模型调用函数，并通过统一的路径解析函数选择数据库。当前入口会在执行命令前应用数据库迁移；首次使用仍建议执行下面的 `npm run db:migrate`，以创建数据库父目录并完成初始化。

### 环境变量与模型选择

在项目根目录创建 `.env`：

```dotenv
ARK_API_KEY=你的_API_Key

# 可选：选择 DeepSeek 时使用
# DEEPSEEK_API_KEY=你的_API_Key

# 可选：省略时使用项目中的 data/sgcoding.db
# SGCODING_DATABASE_PATH=./data/sgcoding.db
```

`.env` 已被 Git 忽略，不要把 API Key 提交到仓库。只需配置所选平台的 Key。dotenv 默认从当前工作目录加载 `.env`；从其他目录执行全局命令时，可提前设置进程环境变量。

`src/model/provider.ts` 当前登记了以下模型：

| 平台 | `--model` 参数值 | 环境变量 |
|---|---|---|
| Ark（默认） | `ark/doubao-seed-2-0-mini-260428` | `ARK_API_KEY` |
| DeepSeek | `deepseek/deepseek-flash` | `DEEPSEEK_API_KEY` |
| DeepSeek | `deepseek/deepseek-v4-pro` | `DEEPSEEK_API_KEY` |

模型参数必须包含平台 ID 和模型 ID，且已在配置表中登记。当前模型层统一使用 Responses 接口；配置表中的条目不代表各平台接口兼容性已经验证，尤其是 DeepSeek，使用前需要实际请求确认。

### 数据库路径

数据库路径优先使用 `createRuntime({ databasePath })` 传入的值；未传入时读取 `SGCODING_DATABASE_PATH`，未配置或配置为空字符串时使用默认路径。

| 配置值 | 含义 |
|---|---|
| 未配置 | 使用相对于数据库模块定位的项目 `data/sgcoding.db` |
| `./data/sgcoding.db` | 相对于运行时工作目录 `process.cwd()` |
| `C:/sgcoding-data/sgcoding.db` | 使用指定的绝对路径 |
| `:memory:` | 使用内存数据库，关闭连接后数据消失 |

相对路径不以 `.env` 文件或 `path.ts` 所在目录为基准。迁移脚本与运行时共用路径解析函数，但当前测试入口显式传入了 `:memory:`，会覆盖环境变量。

## 初始化数据库

执行数据库迁移：

```powershell
npm run db:migrate
```

该命令会先编译项目，再运行数据库迁移：

```powershell
npm run build
node .\dist\database\migrate.js
```

未配置路径时，数据库文件会创建在 `data/sgcoding.db`。迁移脚本会为文件数据库创建父目录。`data/` 属于本地运行数据，不会提交到 Git；如果将数据库改到仓库内其他目录，需要自行设置忽略规则。

如果配置为 `:memory:`，本次迁移只作用于当前连接，不会为下一次命令保留数据库。

## 开发运行

查看帮助：

```powershell
npm run dev -- --help
```

以下对话及会话管理示例以已启用真实模型和文件数据库为前提。开始新对话时，如果没有提供 `--session`，程序会自动创建一个 Session：

```powershell
npm run dev -- run hello world
```

继续已有 Session：

```powershell
npm run dev -- run --session <session-id> hello again
```

将 `<session-id>` 替换为实际输出的 Session ID，不保留尖括号。输入不能为空，已归档的会话需要先取消归档才能继续对话。

指定模型：

```powershell
npm run dev -- run --model ark/doubao-seed-2-0-mini-260428 "你好"
```

成功后会输出会话 ID 和完整回复。模型层虽然以流的方式接收文本，但当前 CLI 会等待收集完成后一次性输出。请求失败会记录错误消息并以非零状态退出，后续构造模型上下文时会排除标记为错误的消息。

### Session 管理

查看最近 10 个未归档 Session（默认使用表格格式）：

```powershell
npm run dev -- session list
```

限制返回数量：

```powershell
npm run dev -- session list --max-count 5
```

输出 JSON：

```powershell
npm run dev -- session list --format json
```

查询时包含已归档 Session：

```powershell
npm run dev -- session list --include-archived
```

这些选项可以组合使用：

```powershell
npm run dev -- session list --max-count 5 --format json --include-archived
```

归档、恢复归档或删除 Session：

```powershell
npm run dev -- session archive <session-id>
npm run dev -- session unarchive <session-id>
npm run dev -- session delete <session-id>
```

归档和取消归档会检查会话状态：重复归档、对未归档会话取消归档，以及操作不存在的会话都会报错。JSON 列表在没有会话时输出 `[]`。

`session list` 选项：

| 选项 | 默认值 | 作用 |
|---|---:|---|
| `-m, --max-count <count>` | `10` | 限制返回的 Session 数量，必须是正整数 |
| `-f, --format <format>` | `table` | 设置输出格式，可选 `table` 或 `json` |
| `--incArc, --include-archived` | 关闭 | 在结果中包含已归档 Session |

查看各级命令帮助：

```powershell
npm run dev -- --help
npm run dev -- run --help
npm run dev -- session --help
npm run dev -- session list --help
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
sgcoding session list
```

`npm link` 只需在首次链接项目、移动项目目录或链接失效后重新执行。平时修改 `src/` 后，重新运行 `npm run build`，全局 `sgcoding` 命令就会使用最新的 `dist/`。

## 检查与构建

只检查 TypeScript 类型，不生成文件：

```powershell
npm run typecheck
```

编译到 `dist/`：

```powershell
npm run build
```

运行编译后的 CLI：

```powershell
npm start -- run "你好"
```

`dist/` 是可重新生成的构建产物，已被 Git 忽略。

## 目录结构

```text
src/
├─ command/        CLI 命令处理
├─ database/       数据库连接、Schema 和迁移入口
├─ event/          事件类型与事件发布
├─ model/          AI SDK 模型调用与 Provider 配置
├─ session/        Session 服务、查询和投影
├─ cliArgs.ts      Commander 参数解析
├─ index.ts        CLI 入口与命令分发
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
