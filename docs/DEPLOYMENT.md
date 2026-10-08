# 部署指南

> 面向第一次把 MAF 装到新电脑上的用户。3 分钟完成。

## 1. 前提

- 已安装 [OpenClaw](https://github.com/openclaw/openclaw) 并完成初始化（有 `~/.openclaw/` 目录）
- OpenClaw 版本 ≥ 0.9，支持 `sessions_spawn`
- 已安装 `git`、`python3`（用于 AnySearch 和 doctor.sh）
- 一个可用的 LLM（在 OpenClaw 里配置），模型你自己定

## 2. 下载并安装

```bash
git clone https://github.com/838997125/openclaw-maf.git
cd openclaw-maf
bash install.sh
```

安装脚本会做 5 件事：

1. 把 `skills/maf`、`skills/maf-trigger` 复制到 `~/.openclaw/workspace-pm/skills/`
2. 把 PM 人格文件模板（AGENTS.md / SOUL.md / IDENTITY.md / TOOLS.md / HEARTBEAT.md）复制到 `~/.openclaw/workspace-pm/`（**已存在的不覆盖**）
3. 复制 `USER.md` 模板（仅当该文件不存在时）
4. 复制内置角色库（`vendor/agency-agents-zh/`）到 `~/agency-agents-zh/`（已存在则保留/ pull，vendor 缺失时才联网克隆）
5. 生成 `~/.openclaw/workspace-pm/maf-env.sh`

## 3. 自检

```bash
bash scripts/doctor.sh
```

期待输出：

```
=== Summary: 18 ok, 0 warnings, 0 failures ===
✅ All checks passed — ready to run MAF.
```

如果有 fail，按提示修。常见问题见文末。

## 4. 告诉 OpenClaw PM agent 用这个 workspace

你的 OpenClaw 里需要有一个 agent 的 workspace 指向 `~/.openclaw/workspace-pm`。这个配置通常在 OpenClaw 的 agent 配置文件里，例如：

```yaml
agents:
  pm:
    workspace: ~/.openclaw/workspace-pm
    # model: <你自己的模型>
```

具体字段名以你用的 OpenClaw 版本为准。`IDENTITY.md` 已经声明这个 agent 叫 "PM Agent"。

## 5. 配 AnySearch（推荐，但可选）

```
# 在 OpenClaw 任意对话里说：
clawhub install anysearch
```

然后编辑 `~/.openclaw/workspace/skills/anysearch/.env`：

```
ANYSEARCH_API_KEY=你的key
```

没有 key 也能匿名跑，只是配额低、可能被限流。

## 6. 填 USER.md

编辑 `~/.openclaw/workspace-pm/USER.md`，写上你的名字、时区、关注的业务领域。PM agent 会据此调整沟通风格。

## 7. 重启 OpenClaw 并使用

重启 OpenClaw（或 reload skills），切到 PM agent，说：

```
启动多智能体：<你的任务>
```

或：

```
/maf <你的任务>
```

PM 会先回一份需求确认单 + DAG 计划，你确认后才开跑。

---

## 自定义路径

所有路径都能通过环境变量改：

```bash
export OPENCLAW_HOME=/path/to/openclaw
export PM_WORKSPACE=/path/to/workspace-pm
export AGENCY_AGENTS_HOME=/path/to/agency-agents-zh
export ANYSEARCH_HOME=/path/to/anysearch

bash install.sh
bash scripts/doctor.sh
```

Windows（WSL）用户：把上述路径换成 WSL 内的 Linux 路径即可。MAF 不支持原生 Windows（路径分隔符问题）。

---

## 常见问题

### Q：doctor 说找不到角色库
A：重新跑一次 `bash install.sh` 即可（内置副本在 `vendor/agency-agents-zh/`，离线可装），或设置 `AGENCY_AGENTS_HOME` 指向你的角色库目录。

### Q：doctor 说 Auditor 角色缺失
A：你的角色库版本太旧。`cd ~/agency-agents-zh && git pull`。需要 `testing/testing-reality-checker.md` 和 `testing/testing-evidence-collector.md`。

### Q：AnySearch 报 401 / quota
A：没配 key 或 key 失效。去 AnySearch 官网申请 key，填进 `.env`；没 key 就降低搜索频率。

### Q：子 agent 报"角色文件不存在"
A：检查 `AGENCY_AGENTS_HOME` 路径是否正确，以及角色库是否完整 clone。

### Q：我想用不同模型跑 Executor 和 Auditor
A：在 OpenClaw 的 agent 配置里为 sub-agent 指定模型；或让 PM 在 spawn 时指定 model（MAF v2.3 的 spawn 调用支持模型覆盖，具体看 OpenClaw 文档）。

### Q：能不装 215 角色库吗？
A：不能。MAF Executor/Auditor 都是从这个库加载角色定义的。你也可以把它 clone 到任意位置并 `export AGENCY_AGENTS_HOME=...`。

### Q：安装脚本报 git clone 超时
A：v2.3.2 起角色库已内置在 `vendor/` 中，正常安装不需要联网克隆。仅当 vendor 副本缺失时才会克隆，可用代理或镜像源。

### Q：怎么卸载？
```bash
rm -rf ~/.openclaw/workspace-pm/skills/maf
rm -rf ~/.openclaw/workspace-pm/skills/maf-trigger
# 角色库和 workspace 其他文件自己决定是否删
```
