# SGcoding

SGcoding 是一个学习中的 AI Coding Agent 项目，参考 OpenCode 的服务分层、消息与内容块、事件流和工具调用流程，使用 TypeScript、Node.js 和 Effect 实现。

当前主入口是基于 Ink + React 的终端交互界面（TUI）。工具直接使用 TypeScript/Node.js 实现；Java/Maven 不再是主线依赖。独立的 `run`、`session list/archive/delete` 等 CLI 命令为可选内容，不作为 TUI 使用的前置条件。

## 当前实现

以下描述对应当前源码结构，不代表所有流程已完成运行验证。

- **TUI**：消息区、文本输入、思考内容、附件名称、工具状态和错误提示。
- **会话控制**：创建或加载单个会话，发送问题，取消当前生成，退出时释放共享 Runtime。
- **Prompt 编排**：保存用户消息，读取历史，创建每轮助手消息，并根据工具结果继续调用模型；默认最多 16 轮。
- **模型调用**：AI SDK、可配置 Provider、流式事件转换，以及 Ark Responses 请求适配。
- **消息存储**：使用 Message/Part 保存文本、思考、工具调用与结果，通过 SQLite、Drizzle 和事件投影持久化。
- **工具**：注册 TS 原生 `read` 工具，提供参数校验、文本读取、取消、超时及输出截断。

当前只注册了 `read`。文件写入、编辑、搜索和 shell 执行尚未作为工具注册，不能据此认为 Agent 已具备修改项目或运行命令的能力。

## 环境与安装

- Node.js 22 或更高版本：当前 Ink 8 的包声明要求 Node.js >= 22。
- npm。
- 支持交互输入的终端；以下示例使用 Windows PowerShell。

在项目根目录执行：

```powershell
npm install
```

## 启动 TUI

### 界面预览

```powershell
npx tsx src/tui/preview.tsx
```

预览模式不连接模型或数据库，不需要 API Key。它显示空会话界面，并在提交后显示最近输入，便于单独查看输入与布局。

### 真实会话入口

在项目根目录创建 `.env`：

```dotenv
ARK_API_KEY=替换为你的_API_Key

# 可选：数据库路径
# SGCODING_DATABASE_PATH=./data/sgcoding.db

# 可选：Provider 配置文件，相对路径以当前工作目录为基准
# SGCODING_PROVIDER_CONFIG=./default-provider.yaml
```

然后启动：

```powershell
npx tsx src/tui/index.tsx
```

该入口初始化数据库、应用迁移并创建或加载会话；提交问题时才请求模型。当前工作目录同时作为项目根目录，因此上述命令默认从 SGcoding 根目录运行。

`.env` 和 `data/` 已被 Git 忽略。dotenv 默认从当前工作目录加载 `.env`，也可以直接设置进程环境变量。

### 当前模型选择方式

当前 `src/tui/index.tsx` 的 `main()` 中直接指定：

```ts
const model = "ark/doubao-seed-2-0-mini-260428";
```

目前入口没有读取 `SGCODING_MODEL`，也没有 `--model` 参数。切换模型需要修改这一行，并确保模型已在 Provider YAML 中登记、对应的 API Key 已配置。

### 恢复已有会话

当前入口读取的环境变量拼写是 **`SGCONING_SESSION_ID`**，不是 `SGCODING_SESSION_ID`。下面保留源码中的实际拼写：

```powershell
$env:SGCONING_SESSION_ID = "替换为已有会话ID"
npx tsx src/tui/index.tsx
```

恢复时需要使用保存该会话的同一个数据库。不存在或已归档的会话会在初始化时被拒绝。

清除变量后，下次启动创建新会话：

```powershell
Remove-Item Env:SGCONING_SESSION_ID -ErrorAction SilentlyContinue
npx tsx src/tui/index.tsx
```

当前控制层在顶部“会话”位置初始显示会话 ID。TUI 内的会话列表与切换界面尚未接入。

### 键盘操作

| 按键 | 行为 |
|---|---|
| Enter | 提交非空输入 |
| Esc | 生成过程中取消当前请求 |
| Ctrl+C | 生成过程中取消；空闲时退出 |

生成期间输入框暂停接收输入。取消后会等待当前 Prompt 清理完成，再恢复发送；退出时先结束当前任务，再停止事件订阅并释放 Runtime 和数据库连接。

## Provider 配置

默认读取项目根目录的 `default-provider.yaml`，由 `src/llm/provider.ts` 加载。`SGCODING_PROVIDER_CONFIG` 可指定另一个配置文件。

模型引用采用 `providerID/modelID` 格式，两个 ID 必须对应 YAML 中的键。当前配置文件登记了：

| Provider | 模型引用 | API Key 环境变量 |
|---|---|---|
| Ark | `ark/doubao-seed-2-0-mini-260428` | `ARK_API_KEY` |
| DeepSeek | `deepseek/deepseek-flash` | `DEEPSEEK_API_KEY` |
| DeepSeek | `deepseek/deepseek-v4-pro` | `DEEPSEEK_API_KEY` |

这些是本地配置条目，不代表服务端当前可用性或协议兼容性已经验证。当前 Provider 统一通过 `client.responses(modelID)` 调用 Responses 接口；仅填写 OpenAI 兼容的地址并不自动保证支持此接口。

## 数据库

数据库路径按以下优先级选择：

1. `createRuntime({ databasePath })` 显式传入的路径。
2. `SGCODING_DATABASE_PATH` 环境变量。
3. 相对于数据库模块定位的项目 `data/sgcoding.db`。

| 路径值 | 含义 |
|---|---|
| `./data/sgcoding.db` | 相对于当前工作目录的文件数据库 |
| `C:/sgcoding-data/sgcoding.db` | 指定绝对路径 |
| `:memory:` | 仅当前连接有效，关闭后不保留数据 |

`src/database/service.ts` 在创建连接时创建所需父目录，并应用 `drizzle/` 下的迁移，无需在启动 TUI 前额外执行独立迁移命令。

## read 工具

模型通过工具参数请求读取文本文件：

```json
{
  "filePath": "src/session/prompt.ts",
  "offset": 1,
  "limit": 100
}
```

`offset` 从 1 开始，三个参数均为必填。返回值包括 `title`、供模型使用的 `output`，以及包含路径、行范围、总行数和截断标记的 `metadata`。

| 限制 | 当前值 |
|---|---|
| 文件读取上限 | 10 MiB |
| 单次请求行数 | 1–2000 行 |
| 文件正文输出上限 | 50 KiB，不含额外的路径等说明 |
| 单行保留长度 | 2000 个 UTF-16 编码单元，另加截断提示 |
| 超时信号 | 15 秒，与调用方取消信号合并 |
| 文本格式 | UTF-8；拒绝非法编码和包含 NUL 的内容 |

工具的目标范围是项目内文本文件。当前路径边界判断使用原始 `input.filePath`，而打开文件使用解析后的 `filePath`，两者尚未统一；不能将这一实现视为可靠的符号链接边界或完整权限隔离。权限确认、目录与图片读取、超大文件优化仍属于后续工作。

## 执行流程

```text
TUI 输入
  → Controller.send()
  → Prompt 保存用户消息、读取历史
  → Processor 消费 LLM 事件流
  → AI SDK 调用模型，并执行模型请求的工具
  → Session 发布事件，Event 持久化并更新投影
  → TUI 订阅事件并更新界面
  → 有工具结果时，Prompt 组织下一轮模型调用
```

职责划分：

- **Prompt**：组织历史、工具与多轮调用。
- **LLM**：调用模型，将 SDK 事件转换为项目内事件。
- **Processor**：维护并保存 Message/Part 生命周期，不重复执行工具。
- **工具 execute**：执行实际文件操作。
- **TUI Controller**：持有应用级 Runtime，管理发送、取消、订阅和退出。
- **TUI State**：完整 `message.part.update` 替换 Part，`message.part.delta` 追加文本，避免最终快照重复拼接。

## 目录结构

```text
src/
├─ agent/             Agent 配置与提示词资源
├─ database/          SQLite 连接、路径选择、表结构与迁移加载
├─ event/             事件定义、发布、订阅和数据库投影
├─ llm/               Provider、AI SDK 调用与流事件适配
├─ session/           Session、Store、Message/Part、Prompt、Processor
├─ tools/             TS 工具实现与注册
├─ tui/               Ink 界面、状态更新、控制层与 Runtime
│  ├─ preview.tsx     界面预览入口
│  └─ index.tsx       真实会话入口
├─ cli/               保留的独立 CLI 代码，非主线入口
├─ util/              公共工具与错误类型
├─ cliArgs.ts         旧 CLI 参数代码
└─ SchemaV1.ts        基础 Schema

default-provider.yaml Provider 配置
scripts/              构建资源复制脚本
drizzle/              数据库迁移
data/                 默认本地数据库目录，不提交
dist/                 编译产物，不提交
```

## 开发命令与现有脚本

```powershell
# 类型检查
npm run typecheck

# 编译，并复制 Agent 提示词资源
npm run build

# 编译成功后运行 TUI
node dist/tui/index.js
```

当前 `package.json` 中有几项旧入口尚未同步：

| 脚本或字段 | 当前指向 | 状态 |
|---|---|---|
| `npm run dev` | `src/index.ts` | 当前源码中没有此入口，使用上面的直接 TUI 命令 |
| `npm start`、`bin.sgcoding`、`main` | `dist/index.js` | 没有对应的当前源码入口，不作为 TUI 启动方式 |
| `npm run db:migrate` | 构建后执行 `dist/database/migrate.js` | 当前没有对应迁移入口源码；TUI 初始化会应用迁移 |
| `npm run db:generate` | Drizzle Kit 配置 | 用于根据 Schema 生成迁移文件 |

旧的 `run/session` 命令示例和 `npm link` 用法不再作为本项目当前使用说明。

## 后续方向

- TUI 会话列表、切换和消息滚动。
- 工具输出展开、文件搜索、编辑与命令执行。
- 工具权限、路径边界与错误反馈完善。
- 上下文压缩、恢复与重试，以及后续 Agent 能力。

项目仍在开发中。本文按 2026-11-19 的源码更新；本次文档更新未运行类型检查、构建、测试或真实模型请求，不将源码接线等同于端到端验证通过。
