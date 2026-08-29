# Task ID: 11-b 素材系统 UI 子代理

## 任务
妖怪客栈素材系统 UI：仓库面板（BagPanel）+ DayScreen 第 5 导航 + page.tsx 注册 + ShopPanel 杂货铺 + FacilityPanel 建材消耗显示 + SettlementDialog 战利素材展示。

## 改动文件
- `src/components/game/panels/BagPanel.tsx`（新建，核心交付）
- `src/components/game/DayScreen.tsx`（NAVS + 'bag'，onOpenPanel/PanelKey 类型扩展）
- `src/app/page.tsx`（PanelKey + 'bag'，注册 BagPanel）
- `src/components/game/panels/ShopPanel.tsx`（杂货铺分区）
- `src/components/game/panels/FacilityPanel.tsx`（建材消耗显示 + 禁用态）
- `src/components/game/SettlementDialog.tsx`（📦 战利素材区块）

## 关键实现
- BagPanel：Drawer 结构与 ShopPanel 完全同款（h-[78vh] 暖色渐变）；顶部存储进度条 matCap（>80% 橙色警示文案）；三类 Tabs（MATERIAL_CATS，各 tab 显示分类总数）；素材卡 2 列网格（icon 圆底 + 名称/数量 + desc/售价 + 出售×1 按钮，库存 0 置灰）；灶火做饭区（food tab 顶部：三道菜消耗 chip 带实时库存红色不足态 + 开火；增益状态条 1s 倒计时 interval 仅面板打开时跑，setTimeout(0) 异步对时规避 react-hooks/set-state-in-effect）；万物合成区（build tab 顶部 3 配方行可连点）；「出售多余」一键出售（food/build tab，BASIC_KEEP 基础素材底线 20，高级素材不卖；growth tab 显示「属性石珍贵，不支持一键出售」）。
- ShopPanel 杂货铺：金币 7 件（妖兽肉80/灵米60/妖盐70/灵米酒120/松木150/青石150/铁矿180，3 列小卡整卡可点）+ 灵石 2 件（妖丹4/属性石袋5）；买前校验仓库容量（total >= cap → toast 仓库已满）与余额；扣费用现有 addGold(-price)/addGems(-price) action 组合 addMaterials（未新增 store action，数据层冻结）；属性石袋随机 ELEMENT_ORDER 七属性 → stoneIdFor(el)，toast「开出：水魄石×1」。
- FacilityPanel：Lv.3+ 设施升级显示「🧰 升级还需 🪵松木×N ⛏️铁矿×N」（facilityMatCost；缺料红色 + 容器 rose 边框），按钮 disabled={isMax || !matOk}，handleUpgrade 兜底 toast「建材不足：还缺 松木×3」；Lv.1-2 已建造设施显示小字提示「🧰 Lv.4 起升级需建材（杂货铺有售）」。
- SettlementDialog：result.materialsGained 非空时新增「📦 战利素材」区块（与经验区同款 spring 逐条入场，icon+名+×n）。

## 验证结果
- `bunx tsc --noEmit`：0 错误（含并行代理文件）
- `bunx eslint` 6 个改动文件：0 错误 0 警告
- agent-browser 独立会话（AGENT_BROWSER_SESSION 隔离，避免与 11-a 抢默认浏览器）全链路实测：
  1. 底部导航第 5 项「仓 仓库」→ 打开仓库抽屉：存储 115/300 进度条 38%、三 tab 计数正确
  2. 做饭：家常便饭开火 → 素材 6→5 消耗、增益条「🍽️ 家常便饭 效果中 · 金币+20%」倒计时 29:59 逐秒递减
  3. 合成：5 松木→1 灵木（松木 35→30、灵木 0→1）；出售×1（30→29）；一键出售多余（29→20 留底）
  4. 养成 tab：9 种素材渲染、无一键出售（提示文案在）
  5. 杂货铺：购得妖兽肉×1（金币扣减）；属性石袋两次开出「水魄石×1」、灵石不足 5 时按钮自动 disabled
  6. 设施：注入厨房 Lv.3 + 铁矿不足 → 「升级还需 ⛏️铁矿×3 🪵松木×2」红色 + 按钮禁用；商店买 2 铁矿 → 按钮恢复可点 → 升级成功 Lv.3→Lv.4（建材消耗、下一级新消耗正确显示）
  7. 夜战结算：收服乘黄+英招 + 野妖掉落 → 结算弹窗「📦 战利素材」完整显示（妖兽肉/灵米/松木×6/妖盐/妖丹×5/金晶石/铁矿×3/木灵石…），返回客栈后仓库计数同步增长（food 18→27）
  8. 全程 console 0 报错；测试存档已清理（独立会话 localStorage clear + 关闭浏览器）

## 遗留问题
- 无阻塞项。备注：①仓库满/接近满的一键出售溢出场景逻辑已 review（sellMaterial 逐个调用，总量守恒）但未达 80% 警戒态实测（初始 300 上限较难填满）②11-a 并行改 YaokuiPanel 期间共享默认浏览器会话有互相干扰，自查改用独立 AGENT_BROWSER_SESSION 解决，后续并行代理建议同样隔离。
