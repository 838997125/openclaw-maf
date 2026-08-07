# MAF — Multi-Agent Framework v2.1

> 📌 **版本**：2.1 | **更新日期**：2026-08-05（dw-ecom v3 审查实战复盘）
> **执行模式**：半自动（用户确认 DAG 执行计划后再调度执行）
> **理论来源**：《一文看懂 Multi-Agent：从任务分解到结果交付的 18 步全流程》

---

## 概述

MAF 是运行在 OpenClaw 上的多智能体协作框架。v2.0 从 v1.1 的「PM 全包式」升级为**七角色分工式**架构，核心改变：

> **Multi-Agent 拼的不是模型能力，而是组织能力——把一堆模型组织成一支真正打得赢的团队。**

### v1.1 → v2.0 对比

| 维度 | v1.1 | v2.0 |
|------|------|------|
| 规划 | PM 自己拆任务 | **独立 Planner 角色** |
| 研究 | 混在执行角色中 | **独立 Research Agent**，与执行并行 |
| 审查 | PM 自己审（既当选手又当裁判） | **独立 Reviewer 角色** |
| 协作 | Agent 间消息传递 | **黑板机制**（共享 JSON 存储） |
| 返工 | 整个模块重跑 | **精准派单式返工**，只动有问题的块 |
| 门控 | 无 | **必要性判断**，简单任务不硬套 |
| 数据 | 无统一约定 | **前置 schema 定义** |
| 来源 | 无留痕 | **证据卡**（来源/时间/可信度） |
| 工具 | 无治理 | **原子化调用**（超时/重试/异常） |
| 人审 | 无 | **高风险任务人工审核节点** |
| 迭代 | 3次打回 | **5次 + 第3次风险接受声明** |

---

## 七角色架构

```
用户（甲方）
  ↓ 提任务
Orchestrator（PM / 管理 Agent）
  ├→ Planner（规划师）     拆任务、排依赖、定并行
  ├→ Research（情报员）    搜索、RAG、提炼证据     ┐
  │                                            ├ 双线并行
  ├→ Execute（工程师/写手）写代码、做计算、生成内容 ┘
  ├→ Reviewer（质检员）    查事实、查逻辑、查格式
  └→ Tools（外部世界）     API、数据库、搜索引擎
```

**铁律**：让做事的人不打分，让打分的人不做事。

---

## 18 步全流程

### 第一步：对齐（步骤 1-3）
1. Orchestrator 接收用户任务
2. 识别目标、约束、成功标准
3. 信息不足则澄清；充分则输出需求确认单

### 第二步：拆任务排依赖（步骤 4-5）
4. Planner 拆解大目标为独立子任务（WBS）
5. Planner 排序依赖：哪些并行、哪些串行（DAG）

### 第三步：派活（步骤 6）
6. Orchestrator 按 DAG 分发：检索→Research，产出→Execute

### 第四步：双线并行（步骤 7-11）
7. Research 检索资料 / Execute 开始干活（**同时进行**）
8. Research 提炼关键结论 / Execute 写代码做计算
9. Research 输出证据卡（结论+来源+可信度）
10. 证据和执行结果写入黑板
11. 两条线汇合

### 第五步：收口（步骤 12）
12. Orchestrator 从黑板读取所有产出，拼中间稿

### 第六步：审查（步骤 13-14）
13. Reviewer 独立审查：事实性、逻辑性、格式
14. Reviewer 输出可执行的修改意见

### 第七步：精准返工（步骤 15-16）
15. Orchestrator 按意见精准派单：缺证据→回 Research，做错→回 Execute
16. 修正后流回黑板，重新收口+审查，直到通过

### 第八步：交付（步骤 17-18）
17. Orchestrator 最终整合：统一口径、解决冲突、补全结构
18. 交付用户

---

## 五条设计原则

1. **职责必须分离**：五权分立，不合并角色
2. **先想清楚再动手**：Planner 前置，不让 Execute 边做边想
3. **能并行绝不串行**：DAG 决定并行空间
4. **闭环比单次生成重要**：Reviewer + 反馈回路 = 可迭代纠错
5. **工具能力原子化**：标准化调用，可插拔替换

---

## 八个落地坑防护

| # | 坑 | 防护 |
|---|-----|------|
| 1 | 简单任务硬套 MA | Phase 0 必要性门控 |
| 2 | 角色边界模糊 | 角色卡明确做什么/不做什么 |
| 3 | 省掉 Reviewer | 强制节点不可跳过 |
| 4 | 迭代死循环 | 5轮上限 + 风险声明 + 成本控制 |
| 5 | 中间数据拼不起来 | Planner 阶段前置定义 schema |
| 6 | 外部资料无留痕 | 证据卡强制记录来源/时间/可信度 |
| 7 | 工具调用不稳定 | 权限/超时/重试/异常标准化 |
| 8 | 高风险缺人审 | 法律/财务/医疗类保留人工节点 |

---

## 黑板机制（Blackboard）

`pm_shared_data.json` 作为所有 Agent 的共享存储：

```
pm_shared_data.json
├── task.goal / constraints / success_criteria
├── dag.nodes / edges
├── research[]     ← Research 只写这里
│   └── { id, conclusion, source, fetched_at, confidence }
├── execution[]    ← Execute 只写自己的节点
│   └── { id, node_id, output, references[], status }
├── reviews[]      ← Reviewer 只写这里
│   └── { node_id, round, result, issues[], suggestions[] }
└── final
    ├── draft
    ├── report
    └── unresolved_issues[]
```

**规则**：
- 各角色只写自己的区域
- Orchestrator 读写所有区域
- 跨模块数字以黑板为准，禁止子 agent 自行计算

---

## 质量审核循环

```
Reviewer 审查
  ├→ ✓ 通过 → 交付
  └→ ✗ 不通过
      ├→ 第1-2次：修改意见单 → 精准派单返工 → 重审
      ├→ 第3次：⚠️ 风险接受声明 → 返工 → 重审
      ├→ 第4-5次：继续返工
      └→ 超过5次：自动通过 + 附录C标注未解决问题
```

**精准返工**：缺证据只打回 Research，做错只打回对应 Execute，其他模块不动。

---

## 执行流程

```
用户消息 → main agent（检测触发词）
       ↓ spawn isolated
   PM Orchestrator (isolated)
       ├→ Phase 0: 必要性门控
       ├→ Phase 1: 需求对齐
       ├→ Phase 2: Planner 拆任务 + 排依赖
       ├→ Phase 3: 角色匹配 + 黑板初始化
       ├→ Phase 4: 用户确认 DAG（半自动）
       ├→ Phase 5: 双线并行执行（Research + Execute）
       ├→ Phase 6: 收口（拼中间稿）
       ├→ Phase 7: Reviewer 独立审查
       │   ├→ 通过 → Phase 9
       │   └→ 不通过 → Phase 8 精准返工 → 回 Phase 6
       ├→ Phase 8: 精准返工（最多5轮）
       ├→ Phase 8.5: 人工审核（如适用）
       └→ Phase 9: 最终整合 + 双格式落盘 + 交付
```

---

## 文件结构

```
~/.openclaw/workspace/skills/
├── maf/
│   ├── SKILL.md                  # 框架总览 v2.0
│   ├── README.md                 # 本文档
│   ├── PM-ORCHESTRATOR-SKILL.md  # PM 协调器 v2.0（isolated session 核心）
│   ├── pm-orchestrator.ts        # PM TypeScript 工具函数
│   ├── roles/
│   │   ├── scanner.ts           # 角色库扫描器
│   │   ├── dag_builder.ts       # DAG 构建器
│   │   └── reviewer.md          # Reviewer 角色定义
│   └── executor/
│       └── engine.ts            # DAG 执行引擎
└── maf-trigger/
    └── SKILL.md                 # 触发器 v2.0
```

---

## 触发词

| 触发词 | 示例 |
|--------|------|
| `启动多智能体` | `启动多智能体：帮我分析抖音创业机会` |
| `多智能体协作` | `多智能体协作：帮我规划一个项目` |
| `/maf` | `/maf 帮我分析短视频赛道` |
| `/multi-agent` | `/multi-agent 帮我做市场调研` |

---

## 并行限制

同一时间最多 spawn **3 个**子 agent，超出分批，每批间隔 ≥ 5 分钟。

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0 | 2026-05-27 | 初始版本 |
| 1.1 | 2026-05-27 | 双触发词 + 半自动模式 + 3次打回审核 |
| **2.0** | **2026-08-05** | **七角色架构 + 18步流程 + 黑板机制 + 独立Reviewer + 精准返工 + 必要性门控 + 5原则 + 8坑防护 + 5轮打回 + 人工审核节点** |
| **2.1** | **2026-08-05** | **实战复盘修复：强制子agent文件落盘 + 黑板gate + 即时进度推送 + 完成事件即续跑 + Reviewer问题必须真返工** |
