# 多人协作指南

代码同步使用 **Cursor Origin 托管仓库**，设计和沟通使用 **飞书**。

## 仓库地址

创建后填写：

```
https://origin.cursor.com/junyubi227/Yaoguai-Kezhan.git
网页：https://cursor.com/codebase/junyubi227/Yaoguai-Kezhan
```

## 新人加入（5 分钟）

### 1. 克隆代码

```bash
git clone https://origin.cursor.com/junyubi227/Yaoguai-Kezhan.git
cd yaoguai-kezhan
npm install
```

### 2. 配置本地环境

```bash
cp .env.example .env
cp .cursor/mcp.json.example .cursor/mcp.json
```

编辑 `.env` 和 `.cursor/mcp.json`，填入自己的飞书应用凭证（向负责人索取，**不要提交到 Git**）。

### 3. 查看设计文档

飞书群「妖怪客栈」→ 12 份设计文档（PRD、数值、技能、UI 等）

## 日常开发流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 创建功能分支
git checkout -b feature/你的功能名

# 3. 开发、提交
git add .
git commit -m "feat: 描述你做了什么"

# 4. 推送分支
git push origin feature/你的功能名

# 5. 在 Cursor 网页打开 PR，请队友 review 后合并
```

## 分支命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feature/` | 新功能 | `feature/tower-defense` |
| `fix/` | Bug 修复 | `fix/capture-rate` |
| `docs/` | 文档更新 | `docs/api-readme` |

## 飞书通知（可选）

推送代码后，CI 可向飞书群发送通知。Webhook 地址配置在仓库 Secrets 中，不要写进代码。

## 注意事项

- **永远不要提交** `.env`、`.cursor/mcp.json`（已在 `.gitignore` 中）
- 设计文档更新在飞书，代码更新在 Git，两者通过 README 链接互相关联
- 合并到 `main` 前至少 1 人 review
