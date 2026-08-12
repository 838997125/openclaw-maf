# v2.2 → v2.3 升级要点

## 一句话

v2.3 把 LongHorizon-Harness 启发的 **MEA 三权分立（Manager–Executor–Auditor）** 落进了 MAF，新增独立 fresh-context Auditor、审计门禁、L2 跨模块一致性 checker、task-state 唯一跨轮记忆。

## 新增能力

1. **独立 Auditor**：每个 Executor 完成后，强制 spawn 一个独立 sub-agent（角色 `testing-reality-checker`），用 fresh context 只读审。它看不到 Executor 推理，默认结论 NEEDS WORK。
2. **审计门禁**：没有 Auditor 签字，任何 requirement 不得标 completed。
3. **L2 跨模块一致性 checker**：所有 L1 通过后、L3 汇总前，强制跑一次跨模块数字 diff（角色 `testing-evidence-collector`）。
4. **task-state schema**：`pm_shared_data.json` 里的 `requirements[].status/evidence/history` 字段，只有 Auditor 能写 completed。
5. **Executor 上下文跑完即弃**：raw trajectory 不进长期记忆，跨轮只传审计报告。
6. **可复用模板**：`skills/maf/mea/` 下放了 Executor 和 Auditor 的标准 prompt。

## 安装变化

- 新增运行时依赖：**215 角色库**（自动 clone 到 `~/agency-agents-zh`）
- AnySearch 仍为推荐项（未装会有 warning，不阻塞）
- `install.sh` 现在装到 `~/.openclaw/workspace-pm/skills/`（不是全局 skills）
- 新增 `scripts/doctor.sh` 环境自检
- 新增 `pm-workspace-template/`（PM 人格文件，不覆盖用户已有）

## 不向后兼容的点

- MAF 路径从"全局 skill"改成"workspace-pm 专属 skill"。如果你以前装在 `~/.openclaw/skills/maf`，升级后建议删掉旧的，统一用 `~/.openclaw/workspace-pm/skills/maf`。
- 角色库路径不再硬编码 `/home/zyq/agency-agents-zh`，改成 `$AGENCY_AGENTS_HOME`（默认 `~/agency-agents-zh`）。
- TypeScript 脚手架 `scanner.ts` 里的路径改成读环境变量。

## 升级操作

```bash
cd openclaw-maf
git pull
bash install.sh
bash scripts/doctor.sh
```

期待 `✅ All checks passed`。

## 验证升级成功

在 PM 对话里说一句：

```
/maf 帮我用一句话说明 MEA 三权分立是什么
```

如果 PM 的回复里提到了 Manager / Executor / Auditor、审计门禁、task-state，说明 v2.3 已生效。

## 实战参考

`examples/wuhan-o2o-mea/` 是 v2.3 首次完整实战（武汉医药 O2O 调研，2026-08-10）：
- 7 个业务模块、15 份独立审计报告、6 次返工、L4 终审 P0=0
- 独立 Auditor 抓出：财务利润虚高 3.85×、AI 自动审方合规红线、法规文号错误、市占率合计 130% 等
