# 妖怪客栈 · 飞书全渠道集成

本项目集成了四种飞书连接方式，覆盖 AI 助手直连、程序化 API 调用、消息推送和网页自动化。

| 方式 | 目录/文件 | 用途 |
|------|-----------|------|
| ① MCP Server | `.cursor/mcp.json` | 让 Cursor AI 直接调用飞书 API |
| ② 开放平台 API | `src/api/` | 代码中调用飞书接口（发消息、读文档等） |
| ③ Webhook 机器人 | `src/webhook/` | 群机器人推送 + 应用事件接收 |
| ④ 浏览器自动化 | `src/browser/` | Playwright 操作飞书网页版 |

> 多人协作请阅读 [docs/COLLABORATION.md](docs/COLLABORATION.md)

---

## Cursor 托管仓库（代码同步）

代码存放在 Cursor Origin，飞书负责文档和沟通。

### 首次创建仓库（负责人操作）

1. 打开 [cursor.com/codebase](https://cursor.com/codebase)
2. 首次使用需 **Claim codebase name**（认领团队命名空间）
3. 点击 **New** → 仓库名填 `yaoguai-kezhan` → 可见性选 **Internal**（团队内可见）
4. 复制仓库 HTTPS 地址，在项目根目录执行：

```bash
git remote add origin https://origin.cursor.com/<团队名>/yaoguai-kezhan.git
git push -u origin main
```

> Windows 用户：Origin CLI 需在 WSL 中运行，推荐直接用网页创建仓库 + 标准 git push。

### 队友克隆

```bash
git clone https://origin.cursor.com/junyubi227/Yaoguai-Kezhan.git
```

---

## 自动化（读取 + 推送）

一键配置（WSL）：

```bash
npm run setup
```

| 命令 | 功能 |
|------|------|
| `npm run push` | 推送代码到 Cursor + 自动通知飞书群 |
| `npm run watch:chat` | 每 60 秒轮询群消息，保存到 `.feishu/messages.jsonl` |
| `npm run dev:ws` | 实时监听群消息（长连接） |
| `npm run notify:feishu -- "消息"` | 手动推送到飞书群 |

推送策略：Webhook 优先，失败自动回退**应用机器人** `cursor`。

配置 `git push` 后自动通知飞书：

```bash
npm run setup:hooks   # WSL 中运行
```

---

## 前置准备

### 1. 创建飞书企业自建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app)，创建**企业自建应用**
2. 记录 **App ID** 和 **App Secret**
3. 在「权限管理」中开通所需权限，例如：
   - `im:message` — 获取与发送消息
   - `im:message:send_as_bot` — 以应用身份发消息
   - `im:chat` — 获取群信息
4. 发布应用版本，并在企业管理后台审批通过

### 2. 安装依赖

```bash
npm install
npx playwright install chromium
cp .env.example .env
# 编辑 .env，填入你的凭证
```

---

## ① MCP Server 配置

编辑 `.cursor/mcp.json`，将 `cli_xxxxxxxxxx` 和 secret 替换为你的应用凭证：

```json
{
  "mcpServers": {
    "lark-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@larksuiteoapi/lark-mcp",
        "mcp",
        "-a", "你的_APP_ID",
        "-s", "你的_APP_SECRET"
      ]
    }
  }
}
```

### 需要以用户身份访问（读个人文档、发 IM 等）

先登录获取 OAuth token：

```bash
npm run mcp:login -- -a 你的_APP_ID -s 你的_APP_SECRET
```

然后在 `mcp.json` 的 args 末尾追加：

```json
"--oauth", "--token-mode", "user_access_token"
```

配置完成后，**重启 Cursor**，在 MCP 面板确认 `lark-mcp` 显示为绿色（已连接）。

---

## ② 开放平台 API

```bash
# 验证凭证 + 列出群聊
npm run dev:api

# 向指定群发送测试消息
npm run dev:api -- oc_xxxxxxxxxx
```

代码调用示例：

```typescript
import { sendTextMessage, listBotChats } from './src/api/client.js';

const chats = await listBotChats();
await sendTextMessage('oc_xxx', '你好 🏮');
```

---

## ③ Webhook 机器人

### 方式 A：群自定义机器人（最简单，单向推送）

1. 在飞书群 → 设置 → 群机器人 → 添加自定义机器人
2. 复制 Webhook 地址到 `.env` 的 `FEISHU_BOT_WEBHOOK_URL`
3. 发送测试消息：

```bash
npm run send:bot -- "妖怪客栈上线通知 🏮"
```

### 方式 B：应用事件长连接（推荐，双向通信，无需公网）

1. 确保 `.env` 中已填写 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`
2. 启动长连接客户端：

```bash
npm run dev:ws
```

3. 飞书开放平台 → 事件与回调 → 订阅方式 → 选择「**使用长连接接收事件**」
4. 添加事件 `im.message.receive_v1`（接收消息），保存
5. 在群里 @机器人 发送 `ping`，应收到 `pong 🏮` 回复

### 方式 C：应用事件 HTTP Webhook（需公网地址）

```bash
# 本地开发配合 ngrok
ngrok http 3000
npm run dev:webhook
```

将 ngrok 提供的公网地址配置到飞书开放平台：`https://xxx.ngrok.io/webhook/event`

---

## ④ 浏览器自动化

使用 Playwright 操作飞书网页版，适合 API 无法覆盖的场景。

```bash
# 打开飞书网页（首次需扫码登录）
npm run browser:feishu

# 搜索会话并发送消息
npm run browser:feishu -- "群名称" "你好"
```

登录态保存在 `.playwright/feishu-profile/`，下次自动复用。

### 在 Cursor 内使用内置浏览器 MCP

Cursor 已内置 `cursor-ide-browser` MCP，也可以直接让我操作飞书网页版：

1. 告诉我打开 `https://www.feishu.cn`
2. 你完成扫码登录后，我可以帮你搜索会话、截图、填写内容等

---

## 环境变量一览

| 变量 | 必填 | 说明 |
|------|------|------|
| `FEISHU_APP_ID` | API/长连接/MCP | 应用 App ID |
| `FEISHU_APP_SECRET` | API/长连接/MCP | 应用 App Secret |
| `FEISHU_BOT_WEBHOOK_URL` | 群机器人 | 群自定义机器人 Webhook |
| `FEISHU_BOT_SECRET` | 可选 | 群机器人签名校验 |
| `FEISHU_WEBHOOK_PORT` | 可选 | HTTP Webhook 端口，默认 3000 |
| `FEISHU_ENCRYPT_KEY` | 可选 | 事件加密密钥 |
| `FEISHU_VERIFICATION_TOKEN` | 可选 | 事件校验 Token |

---

## 常见问题

**MCP 显示红色？** Beta 阶段偶发，若工具能正常调用可忽略。

**长连接保存失败？** 必须先 `npm run dev:ws` 启动客户端，确认终端显示「长连接已启动」后再去后台保存。

**API 报权限不足？** 检查应用权限是否开通且已发布审批。

**国际版 Lark？** 在 `.env` 设置 `FEISHU_DOMAIN=https://open.larksuite.com`，并在 `mcp.json` 追加 `"--domain", "https://open.larksuite.com"`。

---

## 协作者

- kyl（本机已接入 Origin 同步，详见 `docs/MY-SETUP.md`）
