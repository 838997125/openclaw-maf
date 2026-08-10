# MEA 模式资产（MAF v2.3）

本目录沉淀 LongHorizon-Harness 启发的 Manager–Executor–Auditor 三权分立模式的可复用资产。

## 文件
- `executor-prompt-template.md` — L1 业务模块 Executor 的标准 prompt 模板（含 MEA 身份声明、SSOT 数字铁律、增量落盘、自检三项）
- `auditor-prompt-template.md` — 独立 Auditor 的标准 prompt 模板（fresh context、默认 NEEDS WORK、只读完整性、python 重算、URL 抽查、P0/P1/P2 分级、强制原文引用）
- `l2-consistency-checker.md` — L1→L2 强制跨模块数字一致性 checker 的 prompt（如有）

## 角色映射（无需新增角色，全部来自 215 角色库）
| MEA 角色 | 215 角色库 |
|---|---|
| Manager | PM Orchestrator（本 agent） |
| Executor | 按模块主题匹配业务专家 |
| Auditor（主） | `testing-reality-checker` 现实检验者 |
| Auditor / L2 checker（备份） | `testing-evidence-collector` 证据收集者 |
| L3 汇总 | `project-manager-senior` 高级项目经理 |

## 试点案例
- 任务：武汉医药O2O市场调研分析（2026-08-10）
- 产物：`/root/.openclaw/workspace-pm/outputs/wuhan-o2o-mea-pilot/`
- 结果：7 模块 / 15 份审计报告 / 6 次返工 / L4 终审 P0=0
- 关键验证：独立 Auditor 抓出 M6 利润虚高3.85倍、M7 AI替代药师合规红线、M3 法规文号错误、M2 市占率超100%、L2 跨模块零P0冲突

## 何时启用 MEA（而非普通 MAF 流程）
- 数字敏感（财务测算、市场规模、对账）
- 合规敏感（医药、金融、法律、数据隐私）
- 长程多模块（≥5 个 L1 模块、总字数 ≥3 万）
- 跨模块数字必须一致（上次同题报告栽在药店数/GMV 冲突）
简单单模块任务仍走普通 MAF，不必硬套。
