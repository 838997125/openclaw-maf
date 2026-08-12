---
name: maf
description: 多智能体协作框架 v2.3。当用户说"启动多智能体"、"多智能体协作"、"/maf"、"/multi-agent"时激活。七角色架构（Orchestrator/Planner/Research/Execute/Reviewer/Tools/User）+ 18步全流程 + 黑板机制 + 精准返工 + 独立审查。半自动模式。v2.3：MEA 三权分立（Manager-Executor-Auditor）+ 独立 fresh-context Auditor + 审计门禁（无审计证据不标完成）+ L1→L2 强制跨模块数字一致性 checker + task-state 唯一跨轮记忆。
---

# MAF — Multi-Agent Framework v2.3

> **版本**：2.3 | **更新日期**：2026-08-10（基于 LongHorizon-Harness 论文 MEA 模式 + 武汉医药O2O市场调研 MEA 试点实战复盘）
> **执行模式**：半自动（用户确认 DAG 执行计划后再调度执行）
> **调用路径**：OpenClaw sessions_spawn（路径 A）
> **文件权限**：可增改查所有文件，删除需用户确认
> **理论来源**：《一文看懂 Multi-Agent：从任务分解到结果交付的 18 步全流程》

## v2.2 实战修复（2026-08-07 武汉医药O2O战略报告复盘）

10 个子 agent、6 小时、81KB 终稿 + 10 份原文归档的实战暴露 8 个问题，v2.2 全部修复：

| # | v2.1 实战问题 | v2.2 修复 |
|---|--------------|----------|
| 1 | 9/10 模块输出截断，反复续补 1-2 次 | **强制 write-tool 落盘契约**：>3000 字必须分块写文件，消息回执 ≤300 字；prompt 中给出绝对路径 |
| 2 | L1 模块原文没即时落盘，事后派归档 agent 回溯 | **完成即验证三件套**：`ls -la <path>` + `wc -c <path>` + `tail -20 <path>`，缺一即视为未完成 |
| 3 | L1 阶段跨模块数字冲突（药店4800 vs 8500、GMV 23亿 vs 55亿） | **预-spawn SSOT 基线**：数字敏感型任务在 spawn 前先定 anchor 数字写入黑板；prompt 中明列"所有数字以黑板为准，禁止自行计算" |
| 4 | 续补指令本身太长导致二次截断 | **续补三段式**：①引用最后20字断点 ②必须补全清单（≤5项） ③硬字数上限 ≤1500 字 |
| 5 | 子 agent 自称"已保存"但实际截断 | **不信回执信字节数**：以 `wc -c` 的实际字节为准，子 agent 自报字节数与磁盘对账 |
| 6 | L1.6 财务 GMV 虚高 3.6 倍（25.8亿 vs 合理值10亿） | **子 agent 自检三项**：报告结尾必须自报"市占率/单节点产能/投资回报"常识校验，任一偏离行业基准 50% 必须自我否决 |
| 7 | yield 后用户干等 5-7 分钟追问"为啥停了" | **心跳进度**：yield 超过 3 分钟主动发一行进度卡片；长任务每 2-3 分钟更新一次 |
| 8 | L2.2 把文件写到错误目录 | **绝对路径硬约束**：output_path 必须以 `/` 开头；prompt 中重复 2 次（任务头+输出要求） |

### 新增 v2.2 子 agent prompt 模板（强制段落）

```
## 输出要求（强制）
1. 用 write 工具把完整报告写到绝对路径：$HOME/.openclaw/workspace-pm/outputs/<task>/modules/<TASK_ID>.md
2. 写作过程：每写完一章立即 write 一次（增量写），不要等到最后一次性输出
3. 完成后在消息中只回复三行：\   - 已保存：<绝对路径>
   - 字节数：<wc -c 实际值>
   - 自检：市占率=X%（行业基准Y%）/单节点月GMV=Z万（行业基准W万）/投资回收期=N年
4. 不要把报告全文贴回消息，消息正文 ≤ 300 字
```

### 新增 v2.2 PM 完成事件处理 SOP

收到 `subagent task completed` 事件后，**立即**按顺序执行：

1. `sessions_history` 拉取最后 2 条消息，检查是否有 truncated 标志
2. `ls -la <output_path>` + `wc -c <output_path>` 验证文件实际大小
3. `tail -30 <output_path>` 检查结尾是否完整（应有结论/结语章节）
4. 若文件不存在 / 字节数 < 预期 50% / 结尾截断：立即发续补三段式指令，**不等用户追问**
5. 若文件完整：输出一张审核卡片（模块名/字节/字数/4 门槛检查/原文引用）

### 新增 v2.2 数字一致性预校验

数字敏感型任务（市场规模/财务测算/用户数/投资回报）在 Phase 3 角色匹配时增加一步：

- PM 先用 1-2 次 AnySearch 或调用一个轻量 research agent，确定 5-10 个 anchor 数字（总人口/市场规模/客单价/行业毛利率/平台佣金率/单店投资等）
- 写入 `pm_shared_data.json.ssot` 字段
- 后续所有 execute agent 的 prompt 中必须包含 "## 数字铁律（SSOT）" 段落，列出 anchor 数字并声明"禁止自行计算，表外数字必须先请 PM 更新黑板"
- L1 全部完成后 spawn 独立 checker（如 v2.1 已有），但 v2.2 要求 checker 同时验证"子 agent 是否真的引用了 SSOT"

---

## v2.3 核心升级：MEA 三权分立（2026-08-10 武汉医药O2O MEA 试点落地）

### 理论来源
LongHorizon-Harness（阿里高德 DreamX，arXiv:2608.01964）证明：长程任务失败的根因不是模型能力不足，而是**任务状态管理失败**——上下文腐烂、状态漂移、未经验证的前提进入记录。其方案是把传统 Agent 的"一个会话自己跑、自己评估自己"拆成三个角色：

| 角色 | MAF 映射 | 权限 | 上下文 |
|------|---------|------|--------|
| **Manager** | PM Orchestrator（本 agent） | 派下一轮子任务合同；**不能直接写业务文件/改 requirement 状态** | 长期，累积审计报告 |
| **Executor** | 业务专家 sub-agent（从 215 角色库匹配） | **唯一能写 modules/*.md 业务文件**；写完即弃 raw 上下文 | 每轮 fresh isolated context，跑完丢弃 |
| **Auditor** | `testing-reality-checker`（现实检验者）独立 sub-agent | **唯一能把 requirement 标 completed**；只读业务文件 + 验收标准；写 audits/*.md | fresh isolated context，**看不到 Executor 的推理过程** |

### 四原则（必须遵守）

1. **P1 动态分解、目标固定**：Manager 每轮读审计通过的 task-state，派下一个子任务合同（目标+验收标准+边界+依赖证据）。
2. **P2 审计落地的进度（审计门禁）**：**没有 Auditor 签字的审计证据，任何 requirement 不得标 completed**。Executor 自报"已完成"不算数。这是 MEA 的灵魂。
3. **P3 轮内执行、上下文隔离**：每个 Executor 在独立 isolated sub-agent 里跑，raw 轨迹跑完丢弃；跨轮只传压缩审计报告 + 黑板 SSOT。dense 的工具输出/中间推理不污染长期记忆。
4. **P4 出错可重置但不失忆**：Executor 的错误要么被下一轮 Auditor 揭穿、要么压根没进入 task-state，错误被关在当轮；审计报告区分"仍可信"与"需修复"。

### Auditor 铁律（与 v2.2 Reviewer 的关键区别）

- **独立 sub-agent**：Auditor 不是 PM 自己，是用 `sessions_spawn` 另起的一个 isolated sub-agent（角色 `testing-reality-checker`，备份 `testing-evidence-collector`）。
- **fresh context + 信息隔离**：Auditor 的 prompt **只给验收标准 + 待审文件路径 + 黑板 SSOT**，**不给 Executor 的 system prompt、推理过程、raw 输出**。它像外部审计一样自己读文件、自己 grep、自己用 python/web_fetch 验证。
- **默认结论 NEEDS WORK**：Auditor 默认为"不通过"，除非有压倒性证据证明通过。
- **只读完整性**：Auditor 不得修改 modules/*.md 业务文件，只能写 audits/audit-<module>-round-<n>.md。若 Auditor 改了受保护业务文件，审计报告标记"完整性违规"，无效。
- **必须引用原文**：审计通过时必须引用输出中的具体段落（含行号），否则审核无效（沿用 AGENTS.md v3）。
- **打回透明**：每打回一次 PM 立即向用户汇报：模块名/第几次/具体问题/修改建议。

### 标准执行流程（MEA 增强版）

```
Phase 0  SSOT 基线：PM 用 AnySearch 预采 anchor 数字 → 写 pm_shared_data.json
         （所有数字型 Executor prompt 顶部贴"## 数字铁律 SSOT"段，禁止自行重算 anchor）
    ↓
L1 业务模块（分批，≤3 并发）：
  for each module:
    ① Executor（业务专家）fresh context 写 modules/M*.md，增量 write，跑完即弃
    ② 【强制】立即 spawn Auditor（testing-reality-checker），fresh context
       只拿验收标准+文件路径+SSOT，独立读文件/grep/python验算/web_fetch抽查URL
       → 写 audits/audit-M*-round-N.md
       → 签字：✅ completed / ❌ 打回（列P0/P1，Executor 返工，raw context 丢弃重来）
    ③ 打回不自动通过；同一模块返工不限硬次数（以质量为准），
       但向用户透明汇报每一次；反复同类问题升级人工
    ↓
L2 【强制节点】跨模块数字一致性 checker（testing-evidence-collector）：
  - diff 所有模块的跨模块数字（药店数/GMV/市占率/毛利率/客单价/口径/留存年限…）
  - 输出冲突清单：P0（直接数字矛盾，必须返工）/ P1（口径不一致，L3前修订）/ P2（表述瑕疵）
  - 这一步不可跳过——上次同题报告就是栽在 M1药店4800 vs 其他8500、GMV 23亿vs55亿
    ↓
L3 综合汇总（project-manager-senior）：
  - 只读审计通过的 modules + SSOT + L2 冲突清单
  - L2 的 P1 正确口径作为硬约束写进 L3 prompt，终稿统一采用
  - 写 final/<report>.md，增量 write
    ↓
L4 终审 Auditor（fresh context 新实例）：
  - 独立审终稿：验收逐条核对 + 财务算术 python 重算 + 4项口径专项验证
    + 战略建议可执行性评级 + 合规红线 grep + 回查模块忠实度
  - 签字可交付 / 打回 L3
    ↓
交付：终稿 .md + 机读摘要 .json（双格式，SOUL 规则8）
```

### task-state：唯一跨轮记忆

黑板 `pm_shared_data.json` 增加结构化任务状态（只有 Auditor 能写 status=completed）：

```json
{
  "phases": {"l1_modules":"in_progress", "l2_consistency_check":"pending", ...},
  "requirements": {
    "M1_market_size": {
      "title": "...", "role": "...", "status": "pending|in_progress|completed|blocked|untrusted",
      "output_path": "modules/M1.md",
      "acceptance_criteria": ["..."],
      "evidence": "audits/audit-M1-round-1.md#结论",
      "history": [{"round":1,"result":"pass|fail","issues":[...],"auditor":"..."}]
    }
  },
  "ssot": { /* anchor 数字，Executor 只读 */ },
  "audit_reports": [...],
  "unresolved_risks": [...]
}
```

写入权限：Executor 只写 modules/；Auditor 写 audits/ 且只能更新 requirement.status/evidence；Manager（PM）只更新 phases，**不能自己把 requirement 标 completed**。

### 角色选用

- **Auditor 主角色**：`testing-reality-checker`（现实检验者）——"默认 NEEDS WORK，要求压倒性证据才认定就绪"，与 MEA Auditor 哲学 1:1 对应。已在 215 角色库中，**无需新增**。
- **Auditor 备份/证据链**：`testing-evidence-collector`（证据收集者），用于 L2 跨模块一致性 checker。
- **Executor**：按模块主题从 215 角色库匹配业务专家（市场/财务/合规/供应链等）。
- **L3 汇总**：`project-manager-senior`（高级项目经理）。

### 试点实测结果（2026-08-10 武汉医药O2O，7 模块）

- 7 个业务模块 → 15 份独立审计报告 → 6 次模块返工 → L4 终审 P0=0 交付
- **独立 Auditor 抓出、PM 自审极可能放过的硬伤**：
  - M6 财务：平台营业利润把"GMV×8%"当利润（应为平台收入×8%），**虚高 3.85 倍**——与上次 GMV 虚高 3.6 倍同类错误
  - M7 技术：设计了"低风险处方 AI 自动通过"，**违反药师审方法定环节**的合规红线
  - M3 合规：4 个国家/省级法规文号错误或无法证实（含一轮审计自己幻觉出的文号，被二轮独立审计证伪）
  - M2 竞争：市占率区间中位合计 107.5%、上限 130%
  - M4 供应链：18 类武汉本地数字无真实来源
  - M5 消费者：老龄化比例用常住人口估算偏差（实际户籍 60+ 为 24.08%）
- **L2 跨模块一致性：0 个 P0 冲突**（对比上次同题报告的药店数/GMV 严重冲突，SSOT 前置 + 独立 checker 根治）
- 结论：**MEA 模式值得作为长程/数字敏感/合规敏感任务的默认执行模式**。代价是多了审计轮次，收益是财务虚高、合规红线、法规文号、跨模块数字冲突这些"灯下黑"问题被独立 fresh-context 审计拦住。

---

## v2.1 实战修复（2026-08-05 dw-ecom v3 审查复盘）

首次 v2.0 实战（6 角色、约 20 分钟完成对 dw-ecom 架构方案的全面审查）暴露 6 个执行问题，v2.1 全部修复：

| # | v2.0 实战问题 | v2.1 修复 |
|---|--------------|----------|
| 1 | 子 agent 报告未落盘，只能从会话历史撈 | **强制文件输出契约**：prompt 中明写 output_path，PM 收到完成事件后 `ls -la` 验证 |
| 2 | 长报告在消息历史中被 truncated | **分块写作**：>2000 字必须 write 文件，消息中仅 300 字摘要 |
| 3 | yield 后完成事件到达，PM 没主动续跑 | **完成事件即触发器**：不等待用户下一条消息，立即审核/启动下游 |
| 4 | 黑板定义了但运行时未创建 | **黑板 gate**：Phase 1 必须先 write pm_shared_data.json，后续 spawn 都读它 |
| 5 | 进度推送不及时，用户中途催促 | **节点级推送**：每个 spawn/完成/打回即时输出一行卡片 |
| 6 | Reviewer 发现问题但 PM 静默修改 | **精准返工强制执行**：P0/P1 必须打回，PM 不得代为修改 |

---

## v2.0 核心变化

从 v1.1 的「PM 全包式」升级为 v2.0 的「七角色分工式」：

| 变化 | v1.1 | v2.0 |
|------|------|------|
| 规划 | PM 自己拆任务 | **独立 Planner 角色**负责拆解和依赖排序 |
| 研究 | 混在执行角色中 | **独立 Research Agent**，与执行线并行 |
| 审查 | PM 自己审 | **独立 Reviewer 角色**，做事与裁判分离 |
| 协作 | Agent 间消息传递 | **黑板机制**（共享存储 `pm_shared_data.json`） |
| 返工 | 整个模块重跑 | **精准派单式返工**，只动有问题的块 |
| 门控 | 无 | **Multi-Agent 必要性判断**，简单任务不硬套 |
| 数据 | 无统一 schema | **前置统一中间产出数据结构** |
| 来源 | 无留痕要求 | **外部资料必须留痕**（来源/时间/可信度） |
| 工具 | 无治理 | **工具调用原子化**（权限/超时/重试/异常） |
| 人工 | 无 | **高风险任务保留人工审核节点** |
| 迭代 | 3次打回 | **5次打回 + 第3次风险接受声明 + 成本上限** |

---

## 触发词

| 触发词 | 说明 | 示例 |
|--------|------|------|
| `启动多智能体` | 完整多智能体协作流程 | `启动多智能体：帮我分析抖音创业机会` |
| `多智能体协作` | 同上 | `多智能体协作：帮我规划一个项目` |
| `/maf` | 命令式，后跟任务描述 | `/maf 帮我分析短视频赛道` |
| `/multi-agent` | 英文命令式 | `/multi-agent 帮我做市场调研` |

---

## 七角色架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户（甲方）                          │
│          提出任务 · 确认计划 · 接收结果                   │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Orchestrator（管理 Agent / PM）             │
│   接需求 · 派任务 · 收结果 · 拼方案 · 交付               │
│   自己几乎不干活，只负责"让事情发生"                      │
└───┬──────────┬──────────┬──────────┬──────────┬────────┘
    ↓          ↓          ↓          ↓          ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Planner │ │Research│ │Execute │ │Reviewer│ │ Tools  │
│ 规划师  │ │ 情报员 │ │ 工程师 │ │ 质检员 │ │ 外部世界│
│        │ │        │ │  写手   │ │        │ │        │
│拆任务  │ │搜索    │ │写代码  │ │查事实  │ │API     │
│排依赖  │ │RAG     │ │做计算  │ │查逻辑  │ │数据库  │
│定并行  │ │提炼证据│ │生成内容│ │查格式  │ │搜索引擎│
└────────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────────┘
               │           │          ↑
               ↓           ↓          │
          ┌─────────────────────────┐ │
          │    黑板（Blackboard）    │ │
          │  pm_shared_data.json    │─┘
          │  共享存储 / 中间产出     │
          └─────────────────────────┘
```

### 角色职责边界

| 角色 | 职责 | 不做什么 |
|------|------|---------|
| **Orchestrator** | 对齐目标、派任务、收结果、整合交付 | 不自己写方案、不自己审 |
| **Planner** | 拆任务、排依赖、定并行/串行 | 不执行任务 |
| **Research** | 搜索、RAG、提炼有证据的结论 | 不写最终方案 |
| **Execute** | 写代码、做计算、生成内容、调工具 | 不给自己打分 |
| **Reviewer** | 查事实、查逻辑、查格式、出修改意见 | 不自己动手改 |
| **Tools** | 提供原子化外部能力 | — |
| **User** | 提任务、确认计划、收结果 | 不管中间过程 |

> **核心原则**：让做事的人不打分，让打分的人不做事。

---

## 18 步全流程

### 第一步：对齐（步骤 1-3）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 1 | 接收用户任务 | Orchestrator |
| 2 | 识别目标、约束、成功标准 | Orchestrator |
| 3 | 信息不足则提问澄清；信息充分则输出「需求确认单」 | Orchestrator ↔ User |

**成功标准不是走过场**——它会在步骤 13-14 被 Reviewer 当作审查尺子。

### 第二步：拆任务排依赖（步骤 4-5）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 4 | Planner 将大目标拆成可独立执行的小任务 | Planner |
| 5 | Planner 排序依赖：哪些并行、哪些串行 | Planner |

Planner 输出 WBS + DAG 依赖图。

### 第三步：派活（步骤 6）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 6 | Orchestrator 按 DAG 分发：检索类→Research，产出类→Execute | Orchestrator |

**底线**：不让一个 Agent 身兼数职。查资料和写方案是两种能力。

### 第四步：双线并行（步骤 7-11）

| 步骤 | 研究线 | 执行线 |
|------|--------|--------|
| 7 | Research 检索资料 / 跑 RAG | Execute 按计划开始干活 |
| 8 | Research 过滤噪声，提炼关键结论 | Execute 写代码 / 做计算 / 生成内容 |
| 9 | Research 输出「证据卡」（结论+来源+可信度） | Execute 调用工具/API |
| 10 | 证据写入黑板 | 执行结果写入黑板 |
| 11 | 两条线汇合到黑板 | — |

**关键**：研究线和执行线是**并行**的，不是排队的。这是 Multi-Agent 效率的核心来源。

### 第五步：收口（步骤 12）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 12 | Orchestrator 从黑板读取研究证据 + 执行结果，拼成中间稿 | Orchestrator |

黑板机制：各 Agent 把产出写入共享存储，Orchestrator 从里面读取整合——比 Agent 间直接发消息更不容易丢信息。

### 第六步：审查（步骤 13-14）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 13 | Reviewer 独立审查中间稿：事实性、逻辑性、格式 | Reviewer |
| 14 | Reviewer 输出可执行的修改意见 + 风险提示 | Reviewer |

Reviewer 查三件事，正好呼应步骤 2 定下的成功标准——首尾闭环。

### 第七步：精准返工（步骤 15-16）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 15 | Orchestrator 按 Reviewer 意见精准派单：缺证据→回 Research，做错了→回 Execute | Orchestrator |
| 16 | 修正后流回黑板，重新收口 + 审查，直到通过 | Orchestrator |

**不是整体重跑**——只动有问题的那块，其余保持不动。

### 第八步：交付（步骤 17-18）

| 步骤 | 动作 | 负责角色 |
|------|------|---------|
| 17 | Orchestrator 最终整合：统一口径、解决冲突、补全结构 | Orchestrator |
| 18 | 交付给用户 | Orchestrator → User |

---

## 五条设计原则

| # | 原则 | 落地要求 |
|---|------|---------|
| 1 | **职责必须分离** | Orchestrator/Planner/Research/Execute/Reviewer 五权分立，不合并角色 |
| 2 | **先想清楚再动手** | Planner 把"怎么做"前置，不让 Execute 边做边想 |
| 3 | **能并行绝不串行** | 用 DAG 依赖图表达先后，不默认排队 |
| 4 | **闭环比单次生成重要** | Reviewer + 虚线反馈回路，迭代纠错 |
| 5 | **工具能力原子化** | Execute 通过标准化工具调用触达外部世界，能力可插拔替换 |

---

## 八个落地坑防护

| # | 坑 | 防护措施 |
|---|-----|---------|
| 1 | 简单任务硬套 Multi-Agent | **门控**：Phase 0 判断任务复杂度，简单任务直接处理 |
| 2 | 角色边界模糊 | **角色卡**：每个角色明确"做什么/不做什么"，spawn prompt 中写明 |
| 3 | 省掉 Reviewer | Reviewer 是**强制节点**，不可跳过 |
| 4 | 迭代死循环/成本失控 | **退出条件**：最多 5 轮返工 + 第3次风险接受声明 + token 成本上限 |
| 5 | 中间数据拼不起来 | **前置 schema**：`pm_shared_data.json` 字段在 Planner 阶段定义 |
| 6 | 外部资料无留痕 | **证据卡**：每条研究结论必须附来源 URL + 时间 + 可信度评级 |
| 7 | 工具调用不稳定 | **工具治理**：每个工具调用设权限、超时、重试、异常处理 |
| 8 | 高风险任务缺人审 | **人工节点**：合规/法律/财务类任务，Reviewer 后加人工确认 |

---

## 黑板机制（Blackboard）

PM 维护 `pm_shared_data.json`，作为所有 Agent 的共享存储：

```json
{
  "task": {
    "goal": "...",
    "constraints": ["..."],
    "success_criteria": ["..."]
  },
  "dag": {
    "nodes": [...],
    "edges": [...]
  },
  "research": [
    {
      "id": "R001",
      "conclusion": "...",
      "source": "https://...",
      "fetched_at": "2026-08-05T12:00:00Z",
      "confidence": "high|medium|low",
      "used_by": ["E001", "E002"]
    }
  ],
  "execution": [
    {
      "id": "E001",
      "node_id": "...",
      "output": "...",
      "references": ["R001", "R003"],
      "status": "pending|in_progress|done|failed"
    }
  ],
  "reviews": [
    {
      "node_id": "...",
      "round": 1,
      "result": "pass|fail",
      "issues": [...],
      "suggestions": [...]
    }
  ],
  "final": {
    "report": "...",
    "unresolved_issues": [...]
  }
}
```

**规则**：
- Research/Execute 只写自己的区域
- Reviewer 只读 + 写 reviews 区域
- Orchestrator 读写所有区域
- L2/L3 节点的 prompt 必须包含："所有数字以黑板为准，禁止自行计算"

---

## 执行架构

```
用户消息 → main agent（检测触发词）
         ↓ spawn isolated session
         PM Orchestrator (isolated)
         ├→ Phase 0: 必要性门控（判断是否需要 Multi-Agent）
         ├→ Phase 1: 需求对齐（目标/约束/成功标准）
         ├→ Phase 2: Planner 拆解任务 + 排依赖
         ├→ Phase 3: 角色匹配 + 黑板初始化
         ├→ Phase 4: 用户确认 DAG（半自动）
         ├→ Phase 5: 双线并行执行
         │   ├→ 研究线：Research Agent（并行）
         │   ├→ 执行线：Execute Agent（并行）
         │   └→ 结果写入黑板
         ├→ Phase 6: 收口（Orchestrator 拼中间稿）
         ├→ Phase 7: Reviewer 独立审查
         │   ├→ 通过 → Phase 8
         │   └→ 不通过 → 精准返工 → 回到 Phase 5/6
         │       （最多 5 轮，第3次出风险接受声明）
         ├→ Phase 8: 人工审核节点（如适用）
         └→ Phase 9: 最终整合 + 交付
```

---

## 质量审核循环（v2.0）

```
Reviewer 审查
  ├→ 通过 ✓ → 进入下一模块
  └→ 不通过 ✗
      ├→ 第1-2次：输出修改意见单 → 精准派单返工 → 重新审查
      ├→ 第3次：⚠️ 出具风险接受声明 → 返工 → 重新审查
      ├→ 第4-5次：继续返工
      └→ 超过5次：自动通过 + 在终稿附录 C 标注未解决问题
```

**审核三维度**：
1. **事实性**：数据对不对、来源可不可靠
2. **逻辑性**：论证通不通、前后是否矛盾
3. **格式**：是否符合约定的输出 schema 和文档结构

**精准返工规则**：
- 缺证据/数据 → 只打回 Research 线
- 做错/写差 → 只打回对应 Execute 节点
- 格式问题 → 打回对应 Execute 节点
- 其他已通过的模块**不动**

---

## 文件结构

```
~/.openclaw/workspace/skills/
├── maf/                          # MAF 主技能目录
│   ├── SKILL.md                  # 本文件（框架总览 v2.0）
│   ├── README.md                 # 完整说明文档
│   ├── PM-ORCHESTRATOR-SKILL.md  # PM 协调器 Skill（v2.0）
│   ├── pm-orchestrator.ts        # PM TypeScript 工具函数
│   ├── roles/
│   │   ├── scanner.ts           # 角色库扫描器
│   │   ├── dag_builder.ts       # DAG 构建器
│   │   └── reviewer.md          # Reviewer 角色定义（v2.0 新增）
│   └── executor/
│       └── engine.ts            # DAG 执行引擎
└── maf-trigger/                  # 触发器 Skill
    └── SKILL.md                 # 触发词定义 + main agent 交互逻辑
```

---

## 并行数量限制

同一时间**最多同时 spawn 3 个子 agent**（不含已完成的），避免触发 Token Plan 全局速率限制。超出 3 个时，分批 spawn（每批间隔 ≥ 5 分钟）。

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0 | 2026-05-27 | 初始版本 |
| 1.1 | 2026-05-27 | 双触发词 + 半自动模式 + 质量审核循环（3次打回） |
| **2.0** | **2026-08-05** | **七角色架构 + 18步全流程 + 黑板机制 + 独立Reviewer + 精准返工 + 必要性门控 + 5条原则 + 8坑防护 + 5轮打回** |
| **2.3** | **2026-08-10** | **MEA 三权分立（LongHorizon-Harness 启发）：Manager/Executor/Auditor 权限分离；独立 fresh-context Auditor（testing-reality-checker），看不到 Executor 推理；审计门禁（无审计证据不标 completed）；只读完整性保护；task-state 唯一跨轮记忆（只有 Auditor 能标 completed）；L1→L2 强制跨模块数字一致性 checker（testing-evidence-collector）；Executor 上下文跑完即弃；武汉医药O2O MEA 试点验证（7模块/15审计/6返工/L4终审P0=0）** |
| **2.2** | **2026-08-07** | **武汉O2O实战复盘：强制 write 落盘+三件套验证、预-spawn SSOT 基线、子agent自检三项、续补三段式、心跳进度、绝对路径硬约束、完成即审 SOP、数字一致性预校验** |
| **2.1** | **2026-08-05** | **实战复盘修复：强制文件落盘 + 黑板gate + 即时进度推送 + 完成事件即续跑 + Reviewer问题必须真返工** |
