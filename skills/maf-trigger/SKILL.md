---
name: maf-trigger
description: 多智能体协作框架触发器 v2.1。当用户说"启动多智能体"、"多智能体协作"、"/maf"、"/multi-agent"时激活。七角色架构 + 18步全流程 + 黑板机制 + 独立Reviewer + 精准返工。v2.1：子agent强制落盘文件、完成事件即续跑、节点级进度推送。
---

# MAF Trigger v2.1 — 多智能体框架入口

> **执行模式**：半自动（用户确认 DAG 后再调度执行）
> **调用路径**：OpenClaw sessions_spawn（路径 A）
> **文件权限**：PM 在 isolated session 可增改查所有文件，删除需用户确认
> **版本**：2.1 | 更新日期：2026-08-05

## v2.1 实战修复

基于 2026-08-05 dw-ecom v3 审查实战复盘：

1. **子 agent 文件落盘强制**：所有 spawn prompt 中明写 output_path，完成后 PM `ls -la` 验证
2. **长内容分块**：>2000 字报告必须 write 文件，消息中仅 300 字摘要
3. **完成事件即续跑**：子 agent 完成事件到达后 PM 立即处理，不等用户催促
4. **进度即时推送**：每个节点状态变更输出一行卡片
5. **Reviewer 问题真返工**：P0/P1 必须打回，不允许 PM 静默修改

---

---

## 触发词

| 触发词 | 说明 | 示例 |
|--------|------|------|
| `启动多智能体` | 完整多智能体协作流程 | `启动多智能体：帮我分析抖音创业机会` |
| `多智能体协作` | 同上 | `多智能体协作：帮我规划一个项目` |
| `/maf` | 命令式，后跟任务描述 | `/maf 帮我分析短视频赛道` |
| `/multi-agent` | 英文命令式 | `/multi-agent 帮我做市场调研` |

---

## v2.0 变化

从 v1.1 升级为七角色分工式架构：
- **新增 Planner 角色**：独立拆任务、排依赖（不再由 PM 自己做）
- **新增独立 Research 线**：与执行线并行，输出证据卡
- **新增独立 Reviewer 角色**：PM 不自己审，由独立 Reviewer 做事实/逻辑/格式三维度审查
- **黑板机制**：所有 Agent 通过 `pm_shared_data.json` 共享数据
- **精准返工**：审查不通过只打回有问题的节点，不整体重跑
- **必要性门控**：简单任务不硬套 Multi-Agent
- **5 轮打回 + 风险接受声明**：第3轮出风险声明，第5轮自动通过
- **人工审核节点**：法律/财务/医疗等高风险内容保留人工确认

---

## 激活流程

### Step 0：检测触发词 + 提取任务

```
用户：启动多智能体：帮我分析抖音短视频创业机会，目标是月入2万
      ↑ 触发词          ↑ 任务描述（提取此部分）

TASK = "帮我分析抖音短视频创业机会，目标是月入2万"
```

如果没有任务描述，引导用户输入。

### Step 1：立即响应

main agent 检测到触发词后**立即**回复：

> ✅ **已启动多智能体协作框架 v2.0**
>
> 七角色架构：Planner（规划）→ Research（研究）+ Execute（执行）双线并行 → Reviewer（独立审查）→ 交付
>
> 📋 PM 正在进行任务必要性评估和需求对齐，请稍候...

### Step 2：启动 PM Orchestrator（isolated session）

```typescript
sessions_spawn(
  runtime="subagent",
  context="isolated",
  label="maf-pm-{timestamp}",
  task=`读取 ~/.openclaw/workspace/skills/maf/PM-ORCHESTRATOR-SKILL.md
按其中 v2.0 流程工作。

{{TASK}} = ${TASK}`,
  runTimeoutSeconds=0
)
```

### Step 3：PM Phase 0-1（必要性门控 + 需求对齐）

PM 首先判断任务是否真的需要 Multi-Agent：
- **不需要**：PM 直接回答用户，流程结束
- **需要**：PM 输出需求确认单，信息不足时通过 main 向用户提问

main agent 负责转发 PM 的澄清问题和用户的回复。

### Step 4：PM Phase 2-3（Planner 拆任务 + 角色匹配）

PM spawn Planner 子 agent 完成任务拆解和 DAG 构建，然后匹配角色库。

### Step 5：用户确认 DAG（半自动模式）

PM 生成执行计划后通过 main 展示给用户：

```
## ⏸️ 执行计划待确认

**任务**：抖音短视频创业机会分析
**总子任务**：6 个 | **并行层级**：3 层
**参与角色**：Planner + 3个Execute + 1个Research + Reviewer

### DAG 执行图

Level 0【双线并行】
  🔍 Research: 市场数据调研（情报员）
  🔍 Research: 竞品信息收集（情报员）
  ⚙️ Execute: 财务模型搭建（财务分析师）

Level 1【并行】
  ⚙️ Execute: 内容策略（内容创作者）← 依赖 Research
  ⚙️ Execute: 运营增长路径（增长黑客）← 依赖 Research

Level 2【串行】
  📋 收口汇总（Orchestrator）
  🔍 Reviewer 独立审查（质检员）
  📦 最终交付

### 质量保障
- ✅ 独立 Reviewer 三维度审查（事实/逻辑/格式）
- ✅ 精准返工（只重做有问题的模块）
- ✅ 最多 5 轮迭代
- ✅ 黑板机制保证数字一致性

请确认：输入"确认"开始执行，或提出修改意见。
```

- **用户确认** → 进入 Step 6
- **用户提修改意见** → PM 调整 DAG 后重新展示
- **用户取消** → 停止

### Step 6：双线并行执行

```
PM(isolated)
  ├→ spawn Research Agent（检索证据）───┐
  ├→ spawn Research Agent（检索证据）───┤ 并行
  └→ spawn Execute Agent（产出内容）───┘
         ↓
  结果写入黑板（pm_shared_data.json）
         ↓
  sessions_yield（等待 Level 0 完成）
         ↓
  PM 收口（拼中间稿）
         ↓
  spawn Reviewer（独立审查）
         ↓
  ├→ 通过 → 最终交付
  └→ 不通过 → 精准派单返工 → 重新收口 → 重新审查
```

### Step 7：进度同步

每个关键状态变更，PM 通过 `sessions_send` 推送摘要卡片给 main，main 转发给用户：

```
[L0.R01] ✅ 市场数据调研 | 8条证据卡 | 0次返工
[L0.E01] ✅ 财务模型 | 3年预测 | 1次返工（数字口径修正）
[L0.R02] 🔄 竞品信息收集 | 进行中...
[Review] ❌ 第1轮不通过 → 返工 E01(ROI计算错误) + R02(缺2个竞品数据)
[Review] ✅ 第2轮审查通过
```

### Step 8：最终交付

PM 整合后通过 main 发送完整报告，包含：
- 执行摘要
- 各模块内容
- 附录 A：角色任务分配表
- 附录 B：研究证据索引
- 附录 C：质量控制记录
- 附录 D：数字一致性声明

---

## 消息转发机制

```
┌─────────────────┐    sessions_send     ┌─────────────────┐
│  PM (isolated)  │ ──────────────────→ │  main session    │
│                 │                      │                 │
│ Phase 0-1:      │                      │  转发给用户      │
│  · 必要性判断   │ ← sessions_send ←── │  等待用户输入    │
│  · 需求澄清     │                      │                 │
│ Phase 4:        │                      │                 │
│  · DAG 确认    │                      │                 │
│ Phase 6:        │                      │                 │
│  · 进度卡片    │                      │  展示进度        │
│ Phase 8:        │                      │                 │
│  · 最终交付    │                      │                 │
└─────────────────┘                      └─────────────────┘
```

---

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| PM spawn 失败 | 回复："多智能体框架启动失败，请稍后重试" |
| Phase 0 判断不需要 MA | PM 直接回答，不启动后续流程 |
| 子 agent 失败 | 重试该节点（最多3次），持续失败则跳过并在附录标注 |
| Research 搜索不可用 | PM 明确告知用户，不凭记忆编造 |
| 5轮返工仍不通过 | 自动通过 + 附录 C 标注未解决问题 |
| 用户取消 | 通知 PM 停止，终止所有子 agent |
| PM 请求删除文件 | main 向用户确认后再执行 |

---

## 依赖资源

| 资源 | 路径 |
|------|------|
| PM Orchestrator Skill v2.0 | `~/.openclaw/workspace/skills/maf/PM-ORCHESTRATOR-SKILL.md` |
| 角色库 | `/home/zyq/agency-agents-zh` |
| 角色列表 | `/home/zyq/agency-agents-zh/AGENT-LIST.md` |
| AnySearch Skill | `~/.openclaw/workspace/skills/anysearch/` |

---

## 版本信息

- 版本：2.1
- 更新日期：2026-08-05
- v2.1 更新：实战复盘修复——子agent强制文件落盘、完成事件即续跑、节点级进度推送、Reviewer问题必须真返工
- v2.0 更新：七角色架构 + 18步全流程 + 黑板机制 + 独立Reviewer + 精准返工 + 必要性门控 + 5轮打回 + 人工审核节点
