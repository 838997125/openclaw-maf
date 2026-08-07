# 架构说明

## 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                       User（甲方）                            │
│           提出任务 · 确认 DAG · 接收交付 · 中途干预            │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│             OpenClaw sessions_spawn（隔离会话）               │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                PM Orchestrator（本 skill）                    │
│                                                              │
│  Phase 0  必要性门控                                         │
│  Phase 1  需求对齐                                           │
│  Phase 2  Planner 拆解 → DAG                                 │
│  Phase 3  角色匹配 + 黑板初始化                              │
│  Phase 4  ⏸ 用户确认 DAG                                    │
│  Phase 5  双线并行执行（Research + Execute）                 │
│  Phase 6  收口（拼中间稿）                                   │
│  Phase 7  Reviewer 独立审查                                  │
│  Phase 8  人工节点（可选）                                   │
│  Phase 9  最终整合 + 双格式交付                              │
└────────┬───────────────────────────────────────┬────────────┘
         ↓                                       ↓
┌──────────────────┐                   ┌──────────────────┐
│  Research 线     │                   │  Execute 线      │
│  （并行）        │                   │  （并行 ≤3）     │
│                  │                   │                  │
│  • 搜索          │   ┌──────────┐    │  • 写手 agent    │
│  • RAG           │   │  黑板    │    │  • 工程师 agent  │
│  • 证据卡        │←→ │ pm_shared│ ←→ │  • 分析师 agent  │
│  • 来源留痕      │   │ _data.   │    │  • 各模块输出    │
│                  │   │ json     │    │                  │
└──────────────────┘   └──────────┘    └──────────────────┘
                             ↑
                             │
                    ┌────────┴────────┐
                    │  Reviewer 线    │
                    │  （独立审）      │
                    │  事实/逻辑/格式  │
                    └─────────────────┘
```

## 核心设计原则

### 1. 职责分离

让做事的人不打分，让打分的人不做事。PM 自己几乎不写内容，只负责协调。

### 2. 先想清楚再动手

Planner 在 Phase 2 把"怎么做"前置，不让 Execute 边做边想。

### 3. 能并行绝不串行

用 DAG 依赖图表达先后关系，Research 和 Execute 是并行的。

### 4. 闭环比单次生成重要

Reviewer + 虚线反馈回路，最多 5 轮迭代。

### 5. 工具能力原子化

Execute 通过标准化工具调用触达外部世界（搜索、写文件、跑命令），能力可插拔。

## 黑板（Blackboard）机制

`pm_shared_data.json` 是所有 agent 的共享存储：

```json
{
  "task": { "goal": "...", "constraints": [...], "success_criteria": [...] },
  "dag": { "nodes": [...], "edges": [...] },
  "ssot": {
    "market_size_2025": "22亿",
    "population": "1380.91万",
    ...
  },
  "research": [ { "id": "R001", "conclusion": "...", "source": "..." } ],
  "execution": [ { "id": "E001", "output_path": "...", "status": "done" } ],
  "reviews": [ { "node_id": "...", "result": "pass|fail", "issues": [...] } ]
}
```

**权限规则**：
- Research/Execute agent：只写自己的 section
- Reviewer：只读 + 写 reviews section
- PM：读写所有

## 子 agent Prompt 结构（v2.2 模板）

```
你是【角色名】，<角色职责>。

## 你的任务
<具体任务描述>

## 背景
<客户/项目上下文>

## 数字铁律（SSOT）
| 指标 | 采信值 |
|------|--------|
| ... | ... |
表外数字必须先请 PM 更新黑板，不得自行计算。

## 必须覆盖的内容
1. ...
2. ...

## 输出要求（强制）
1. 用 write 工具写到绝对路径：/abs/path/<TASK_ID>.md
2. 每写完一章立即 write 一次（增量写入）
3. 完成后消息只回三行：
   - 已保存：<path>
   - 字节数：<wc -c 实际值>
   - 自检：市占率=X% / 单节点月GMV=Y万 / 回收期=N年
4. 消息正文 ≤300 字，不要贴全文

## 硬性要求
- 必须使用 AnySearch 搜索真实数据
- 至少搜索 N 个不同 query
- 所有外部数据附来源 URL
- 输出 Markdown，不要代码块包裹
```

## 文件落盘约定

```
~/.openclaw/workspace-<agent>/outputs/<task-slug>/
├── <报告名>.md             # PM 整合的终稿
├── <报告名>.json           # 机读摘要
├── pm_shared_data.json    # 黑板
├── assemble.py            # 终稿组装脚本（>5模块时用）
├── modules/               # 每个子 agent 的完整原文
│   ├── L1_1_<name>_FULL.md
│   ├── L2_3_<name>_FULL.md
│   └── ...
└── session-transcripts/   # 所有会话可读归档
    ├── INDEX.md
    ├── 00_PM_MAIN.md
    └── L*_*.md
```

## 依赖的 OpenClaw 能力

| 能力 | 用途 |
|------|------|
| `sessions_spawn` | 启动隔离子 agent |
| `sessions_send` | 给子 agent 发续补/返工指令 |
| `sessions_yield` | 等待完成事件 |
| `sessions_history` | 读取子 agent 输出 |
| `subagents list` | 查询活跃子 agent |
| `write` / `read` / `edit` | 文件操作 |
| `exec` | 跑 bash 命令（ls/wc/tail/python 等） |
| AnySearch skill（推荐） | 联网搜索 |

## 性能参考（武汉 O2O 案例）

| 指标 | 值 |
|------|-----|
| 子 agent 数 | 10（含 checker、归档员） |
| 总耗时 | 约 6 小时（含 4 次用户中途交互） |
| 累计 token | 25-30 万 |
| 最终报告 | 81KB / 1,313 行 |
| 模块原文总量 | 531KB / 10 份 |
| 会话归档 | 5.6MB / 12 sessions / 515 messages |
| 跨模块数字冲突 | 6 处（全部由 checker 仲裁） |
| 模块打回次数 | 9 次续补、1 次完全重做（L1.6 财务） |
