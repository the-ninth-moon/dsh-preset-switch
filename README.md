# dsh-preset-switch

在 DeepSeek Harness（dsh）Web 界面中，为**运行中的会话**提供 Agent 模式（agent preset）中途切换能力：

- 在输入框工具行、**权限（访问模式）按钮旁边**新增一个「⇄ 模式」按钮；
- 点击弹出预设菜单（内置 + 自定义），选择后**立即切换当前会话的模式**，无需新建会话；
- 切换通过 `agentPresets.recompose` 实时重链 agent scope，并在会话日志记录 `agent-preset/selected` 事件；
- 向模型追加一条 `<system-reminder>` 通知，让模型知道自己的工具与提示词已切换到新模式；
- 也支持直接输入斜杠命令 `/preset <id>` 完成切换。

## 安装

前提：dsh Web 版（本包依赖 host 侧 `commands` 与 `agentPresets` 服务，两者在默认 profile 中均已挂载）。

> **重要：本包是零依赖的**（host 半不 import 任何 `@deepseek-ai/*` 包，只使用 `ctx` 上的公共服务；client 半仅 `require("react")`，由浏览器模块表提供）。它**必须**作为唯一的包实例加载——dsh 的 agent scope 依赖 `@deepseek-ai/dsh-scope` 的模块私有 Symbol，任何 `@deepseek-ai/*` 核心包出现第二份副本都会让 scope 识别失效、所有会话无法创建。所以不要把本包（或任何会带入 `@deepseek-ai` peer 依赖的包）装进 `profiles/web/node_modules`，也不要给它加 `peerDependencies`。

### 一行安装（推荐）

安装脚本自动完成三步：在 profile 根 `npm install`（包进入共享模块根，不产生双包）→ 幂等写入 `cordis.patch.yml` 注册行 → 校验解析。可重复执行，已注册时自动跳过。

**Windows（PowerShell）：**
```powershell
irm https://raw.githubusercontent.com/the-ninth-moon/dsh-preset-switch/master/install.ps1 | iex
```

**macOS / Linux（bash）：**
```bash
curl -fsSL https://raw.githubusercontent.com/the-ninth-moon/dsh-preset-switch/master/install.sh | bash
```

执行后**重启 dsh** 即生效。

### 手动安装（了解细节时）

1. 在 profile 根安装包（注意：不是 `profiles/web` 下，避免双包）：

```bash
cd $DSH_HOME/profiles
npm install github:the-ninth-moon/dsh-preset-switch
```

> 若你的 `profiles/node_modules` 不是 junction 而是真实目录，安装后请把 `profiles/node_modules/dsh-preset-switch` 放进 dsh 实际解析模块的根（与 `@deepseek-ai` 同级的目录）。

2. 编辑 `$DSH_HOME/profiles/web/cordis.patch.yml`，加入：

```yaml
- insert:
    - id: preset-switch
      name: 'dsh-preset-switch'
```

3. 重启 dsh 后生效。

## 使用

1. 打开任意会话（无论哪种模式）；
2. 输入框左下角、权限按钮右侧出现「⇄ 模式」按钮；
3. 点击 → 选择目标模式 → 当前会话立即切换；
4. 模型下一轮会收到模式切换通知。

也可以直接输入 `/preset <id>`（如 `/preset minimal-v3`）。

## 工作原理

- **Client 半**（`lib/client.js`）：注册到 `conversation.input.left` 槽位；菜单数据来自现有 `agentPresets.list` Remote；切换通过会话命令通道 `session.command('/preset <id>')` 执行——与内置 `/permission` 选择器同一机制。
- **Host 半**（`lib/index.js`）：注册 `/preset` 命令；handler 内依次执行
  1. `agentPresets.resolve(id)` 校验目标预设；
  2. `agentPresets.recompose(agent.ctx, id)` 实时重链 scope（与空白会话切换同一 API，不带锁定）；
  3. `session.append('agent-preset/selected', …)` 记录切换；
  4. `session.append('user/message', <system-reminder>…)</system-reminder>` 通知模型。

会话历史中已有的轮次不变，从下一轮起使用新模式的工具与提示词。

## 版本

- **v0.1.0**（当前）：首个可用版本，已在 dsh Web（Windows profile）实测：安装 → 注册 → 重启后按钮出现，切换 + 模型通知均正常。

## 许可

MIT
