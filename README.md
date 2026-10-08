# MAF — Multi-Agent Framework v2.3 (with MEA)

> **运行环境**：[OpenClaw](https://github.com/openclaw/openclaw) ≥ 0.9（需要 `sessions_spawn`）
> **版本**：2.3.0 | **更新日期**：2026-08-12
> **执行模式**：半自动（确认 DAG 后调度执行）
> **理论来源**：LongHorizon-Harness 的 MEA（Manager–Executor–Auditor）三权分立 + 多智能体协作 18 步全流程

---

## 这是什么？

MAF 是运行在 OpenClaw 上的**多智能体协作 skill**，带一个专门的 **PM Agent**（项目经理智能体）。面对复杂任务（市场调研、战略规划、代码审查、深度分析、财务测算等），它不是让一个 agent 硬扛，而是像真正的项目经理：

1. **拆任务**（Planner 拆 DAG）
2. **派专业角色**（从 215 个中文角色库匹配）
3. **独立审计**（每个模块由 fresh-context 的 Auditor 独立核查，PM 不自己给自己打分）
4. **仲裁数字**（L2 跨模块一致性 checker，专治"模块 A 说 4800、模块 B 说 8500"）
5. **汇总交付**（终稿 + 全部模块原文 + 审计报告 + 机读 json）

### v2.3 的核心：MEA 三权分立

借鉴阿里高德 LongHorizon-Harness（arXiv:2608.01964），把"一个会话既干活又自己评估"拆成三个角色：

| 角色 | 谁来当 | 能做什么 | 上下文 |
|------|--------|---------|--------|
| **Manager** | PM Agent（你部署的这个） | 读审计状态、派下一轮任务；**不能改业务文件、不能自己标完成** | 长期，累积审计报告 |
| **Executor** | 215 角色库中的业务专家 | **唯一能写 modules/*.md** 的人；跑完 raw context 丢弃 | 每轮 fresh isolated sub-agent |
| **Auditor** | `testing-reality-checker`（角色库已有） | **唯一能把任务标 completed**；只读业务文件 + 验收标准，写 audit 报告 | fresh context，**看不到 Executor 的推理** |

**铁律：没有 Auditor 签字的审计证据，任何模块不得标 completed。** Executor 自报"做完了"不算数。

在 2026-08-10 武汉医药 O2O 调研试点中，独立 Auditor 抓出了 PM 自审极可能漏过的硬伤：M6 财务利润虚高 3.85 倍、M7 设计了"AI 自动审方"违反药师法、M3 法规文号错误、M2 市占率合计 130%、L2 跨模块零数字冲突。

---

## 30 秒快速开始

### 0. 前提
- 已安装并初始化 OpenClaw
- 已创建一个使用本 workspace 的 agent（叫 PM / 项目经理 / 任意名字）
- 模型由你自己在 OpenClaw 里配置（MAF 不绑定任何模型）
- AnySearch API key（可选，匿名也能用但有速率限制）

### 1. 下载 & 安装

```bash
git clone https://github.com/838997125/openclaw-maf.git
cd openclaw-maf
bash install.sh
```

安装脚本会自动：
- 把 `skills/maf`、`skills/maf-trigger` 复制到 `~/.openclaw/workspace-pm/skills/`
- 把 PM 人格文件（AGENTS.md/SOUL.md/IDENTITY.md/TOOLS.md/HEARTBEAT.md）模板复制到 `~/.openclaw/workspace-pm/`（不覆盖你已有的）
- 把内置的 314 个角色定义（`vendor/agency-agents-zh/`）复制到 `~/agency-agents-zh/`（可通过 `AGENCY_AGENTS_HOME` 改路径）；无需联网拉取第三方仓库
- 生成 `maf-env.sh`
- 提示你安装 AnySearch

### 2. 自检

```bash
bash scripts/doctor.sh
```

应输出 `✅ All checks passed`。有 fail 按提示修。

### 3. 配 AnySearch API key（可选）

```bash
# 在 OpenClaw 里对任意 agent 说：
clawhub install anysearch
# 然后编辑 ~/.openclaw/workspace/skills/anysearch/.env 填 ANYSEARCH_API_KEY
```

没有 key 也能跑（匿名低配额），但调研类任务会明显变慢。

### 4. 配你的模型

在 OpenClaw 的 agent 配置里，把 PM agent 的模型设成你自己的（任意支持 tool calling 的模型均可，推荐 Claude / GPT-5 / Gemini / DeepSeek / Qwen 等）。MAF 本身不挑模型——论文也证明"框架增益是系统属性，不是模型属性"。

### 5. 使用

重启 OpenClaw（或 reload skills），切到 PM agent，对话里说：

```
启动多智能体：帮我做一份武汉医药 O2O 市场调研
```

或者：

```
/maf 分析三个短视频创业方向，给我一份可决策的报告
```

MAF 会：
1. 先回一份需求确认单 + 角色匹配表 + DAG 计划给你确认
2. 你说"开始"后，并行 spawn 业务专家
3. 每个模块完成，独立 Auditor 自动审核、打回或放行（你能看到每次打回）
4. L2 跨模块数字一致性检查
5. L3 汇总、L4 终审
6. 交付完整报告

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCLAW_HOME` | `~/.openclaw` | OpenClaw 配置根目录 |
| `PM_WORKSPACE` | `$OPENCLAW_HOME/workspace-pm` | PM agent 的 workspace 路径 |
| `AGENCY_AGENTS_HOME` | `~/agency-agents-zh` | 角色库安装位置（默认复制内置副本） |
| `AGENCY_REPO` | `https://github.com/jnMetaCode/agency-agents-zh.git` | 仅在 vendor 副本缺失时联网克隆用的备用地址 |
| `ANYSEARCH_HOME` | `~/.openclaw/workspace/skills/anysearch` | AnySearch skill 路径 |

如果你用非标准路径，装之前 export 这些变量即可。

---

## 文件结构

```
openclaw-maf/
├── install.sh                          # 一键安装
├── vendor/
│   └── agency-agents-zh/               # 内置角色库（314 个角色定义，离线可装）
│       ├── LICENSE                     # MIT，Copyright (c) jnMetaCode 等上游作者
│       ├── AGENT-LIST.md / CATALOG.md
│       └── <部门目录>/<role-id>.md
├── LICENSE
├── README.md                           # 本文件
├── scripts/
│   └── doctor.sh                       # 环境自检
├── docs/
│   ├── DEPLOYMENT.md                   # 详细部署/排错
│   └── UPGRADE-v2.3.md                 # v2.2 → v2.3 升级要点
├── skills/
│   ├── maf/                            # 核心框架 skill
│   │   ├── SKILL.md                    # 框架总览（触发词、MEA、七角色、18 步）
│   │   ├── PM-ORCHESTRATOR-SKILL.md    # PM 详细执行手册（918 行规则）
│   │   ├── README.md
│   │   ├── mea/                        # MEA 可复用 prompt 模板
│   │   │   ├── executor-prompt-template.md
│   │   │   ├── auditor-prompt-template.md
│   │   │   └── README.md
│   │   ├── executor/engine.ts
│   │   ├── roles/{scanner,dag_builder}.ts
│   │   └── pm-orchestrator.ts
│   └── maf-trigger/                    # 触发词 skill
│       └── SKILL.md
├── pm-workspace-template/              # PM agent 人格/规则文件模板
│   ├── AGENTS.md                       # 工作流硬规则（4 道审核门槛、打回透明等）
│   ├── SOUL.md                         # PM 人格 + MEA 硬规则 + 搜索工具规则 + 钉钉规则
│   ├── IDENTITY.md
│   ├── TOOLS.md
│   ├── HEARTBEAT.md
│   └── USER.md                         # 模板，请改成你自己的信息
└── examples/
    ├── wuhan-o2o/                      # v2.2 旧实战案例（保留参考）
    └── wuhan-o2o-mea/                  # v2.3 MEA 试点完整产物
        ├── final/wuhan-o2o-report.md   # 15182 字终稿
        ├── modules/M1-M7*.md           # 7 份模块原文
        ├── audits/audit-*.md           # 15 份独立审计报告
        ├── pm_shared_data.json         # 黑板 + SSOT
        └── wuhan-o2o-report.summary.json
```

---

## 何时启用 MEA（vs 普通 MAF）

不是所有任务都要三权分立。按下面判断：

| 任务特征 | 推荐模式 |
|---------|---------|
| 数字敏感（财务测算、市场规模、对账） | **MEA** |
| 合规敏感（医药/金融/法律/数据隐私） | **MEA** |
| 多模块长程（≥5 个 L1 模块、总字数 ≥3 万） | **MEA** |
| 跨模块数字必须一致 | **MEA**（L2 checker 强制） |
| 简单单模块分析 / 一次性问答 | 普通 MAF |

PM 会在 Phase 0 自动判断并告诉你走哪条路径。

---

## 用自己的模型 / 自己的搜索 key

- **模型**：MAF 不调用任何模型 API，所有 spawn 都走 OpenClaw 的 agent 配置。你在 OpenClaw 里给 PM agent 配什么模型，Executor/Auditor sub-agent 就继承什么模型（也可在 spawn 时单独指定）。
- **AnySearch key**：编辑 `~/.openclaw/workspace/skills/anysearch/.env`，填入 `ANYSEARCH_API_KEY=xxx`。没 key 也能匿名用，但配额低。

---

## 升级

```bash
cd openclaw-maf
git pull
bash install.sh   # 会覆盖 skills/ 但不覆盖你已改过的 AGENTS.md/SOUL.md/USER.md
bash scripts/doctor.sh
```

---

## 许可证

本项目 MIT。内置角色库（`vendor/agency-agents-zh/`）来自上游 [jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh)，遵循其 MIT 许可；其 LICENSE 与版权声明（Copyright (c) 2025 Michael Sitarzewski；Copyright (c) 2026 jnMetaCode）随副本一并保留。

---

## 反馈

- Issue：bug / 功能请求
- 实战案例：欢迎把你用 MAF 做的项目 PR 到 `examples/`
