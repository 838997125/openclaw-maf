# MAF — Multi-Agent Framework v2.2

> **运行环境**：[OpenClaw](https://github.com/openclaw) ≥ 0.9
> **版本**：2.2.0 | **更新日期**：2026-08-07
> **执行模式**：半自动（用户确认 DAG 后调度执行）
> **理论来源**：《一文看懂 Multi-Agent：从任务分解到结果交付的 18 步全流程》

---

## 这是什么？

MAF 是运行在 OpenClaw 上的**多智能体协作 skill**。当你面对一个复杂任务（市场调研、战略规划、代码审查、深度分析等），单 agent 一次做不完时，MAF 会：

1. 拆任务（Planner 拆 DAG）
2. 并行调研（Research Agent）
3. 并行执行（Execute Agents）
4. 独立审查（Reviewer Agent，审执分离）
5. 仲裁数字（Checker Agent）
6. 汇总交付（PM Orchestrator）

**就像一个真正的项目经理带团队干活，而不是一个人假装全干了。**

---

## 30 秒快速开始

### 安装

```bash
git clone https://github.com/<your-name>/openclaw-maf.git
cd openclaw-maf
bash install.sh
```

### 使用

在 OpenClaw 对话中说：

```
启动多智能体：帮我做一份武汉地区医药O2O市场调研
```

或者：

```
/maf 帮我分析三个短视频创业方向
```

MAF 会：
1. 先输出一份 DAG 计划给你确认
2. 你确认后并行 spawn 多个子 agent
3. 每个模块完成后即时汇报
4. 最终交付完整报告 + 所有模块原文 + 数字基准

---

## 核心能力

- **七角色分工**：Orchestrator / Planner / Research / Execute / Reviewer / Tools / User
- **18 步全流程**：从对齐到交付
- **黑板机制**：所有 agent 共享 `pm_shared_data.json`，不丢信息
- **审执分离**：Reviewer 独立打分，不自己改自己的卷子
- **精准返工**：哪个模块有问题只重做那个，不整体重来
- **数字一致性 Checker**：跨模块数字冲突时自动仲裁，产出 SSOT
- **强制文件落盘**：>3000 字必须 write 文件，不靠消息历史（避免截断）
- **并行上限 3**：不触发速率限制
- **5 轮打回保护**：含第 3 轮风险接受声明

---

## 实战案例

**examples/wuhan-o2o** 是一个完整的真实项目：

- 客户：武汉某医药电商（30 线上店 + 20 线下店）
- 目标：3 年全域 O2O 覆盖战略
- 投入：10 个子 agent、6 小时、25-30 万 token
- 产出：
  - 81KB / 1313 行最终报告
  - 10 份模块原文（531KB）
  - SSOT 数字基准（仲裁了 6 处冲突）
  - 完整会话归档（5.6MB / 12 sessions / 515 messages）

详见 `examples/wuhan-o2o/README.md`。

---

## 文件结构

```
openclaw-maf/
├── README.md                           # 本文件
├── install.sh                          # 一键安装脚本
├── LICENSE
├── skills/
│   ├── maf/                            # 核心框架 skill
│   │   ├── SKILL.md                    # 框架总览（触发词、7角色、18步）
│   │   ├── PM-ORCHESTRATOR-SKILL.md    # PM 详细执行手册（v2.2 强制规则）
│   │   ├── README.md
│   │   ├── executor/engine.ts
│   │   ├── roles/
│   │   │   ├── scanner.ts
│   │   │   └── dag_builder.ts
│   │   └── pm-orchestrator.ts
│   └── maf-trigger/                    # 触发器 skill
│       └── SKILL.md
├── docs/
│   ├── USAGE.md                        # 详细使用指南
│   ├── ARCHITECTURE.md                 # 架构说明
│   └── UPGRADE-v2.2.md                 # v2.1 → v2.2 升级要点
└── examples/
    └── wuhan-o2o/                      # 真实实战案例
        ├── README.md
        ├── final-report.md
        ├── pm_shared_data.json
        └── modules/
```

---

## v2.2 新功能（2026-08-07）

基于武汉医药O2O战略报告实战复盘，修复了 8 个 v2.1 仍存在的问题：

1. **强制 write-tool 落盘**：>3000 字必须分块写文件，消息回执 ≤300 字
2. **三件套验证**：完成事件后 `ls -la` + `wc -c` + `tail -30` 不信回执
3. **预-spawn SSOT 基线**：数字敏感任务先定 anchor 数字再 spawn
4. **子 agent 自检三项**：市占率/单节点产能/回收期常识校验
5. **续补三段式**：断点20字 + ≤5项清单 + ≤1500字硬上限
6. **3 分钟心跳**：不让用户干等
7. **绝对路径硬约束**：output_path 必须以 `/` 开头
8. **完成即归档 FULL 版**：不事后回溯

详见 `docs/UPGRADE-v2.2.md`。

---

## 系统要求

- OpenClaw ≥ 0.9（需要 `sessions_spawn` 支持）
- Node.js ≥ 18（部分 TS 工具）
- 建议配置：AnySearch skill（用于联网调研）

---

## 许可证

MIT

---

## 反馈

- Issue: 提交 bug 和功能请求
- 实战案例：欢迎把你用 MAF 做的项目 PR 到 `examples/`
