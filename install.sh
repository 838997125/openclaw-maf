# 部署脚本：将 MAF skill 安装到 OpenClaw

set -e

echo "=== MAF (Multi-Agent Framework) 安装程序 ==="
echo ""

# 定位 OpenClaw 配置目录
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
SKILLS_DIR="$OPENCLAW_HOME/skills"

if [ ! -d "$OPENCLAW_HOME" ]; then
    echo "❌ 未找到 OpenClaw 配置目录：$OPENCLAW_HOME"
    echo "   请先安装 OpenClaw 并完成初始化，或设置 OPENCLAW_HOME 环境变量"
    exit 1
fi

if [ ! -d "$SKILLS_DIR" ]; then
    mkdir -p "$SKILLS_DIR"
    echo "📁 创建 skills 目录：$SKILLS_DIR"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 复制 maf skill..."
rm -rf "$SKILLS_DIR/maf"
cp -r "$SCRIPT_DIR/skills/maf" "$SKILLS_DIR/maf"

echo "📦 复制 maf-trigger skill..."
rm -rf "$SKILLS_DIR/maf-trigger"
cp -r "$SCRIPT_DIR/skills/maf-trigger" "$SKILLS_DIR/maf-trigger"

echo ""
echo "=== 安装的文件 ==="
find "$SKILLS_DIR/maf" "$SKILLS_DIR/maf-trigger" -type f | sort | sed "s|$SKILLS_DIR/|  |"

echo ""
echo "✅ MAF v2.2 安装完成！"
echo ""
echo "📖 下一步："
echo "  1. 重启 OpenClaw（或重新加载 skills）"
echo "  2. 在对话中说 '启动多智能体：<你的任务>'"
echo "  3. 或使用 /maf <任务> 命令"
echo ""
echo "📚 文档："
echo "  - $SKILLS_DIR/maf/SKILL.md (框架主文档)"
echo "  - $SKILLS_DIR/maf/PM-ORCHESTRATOR-SKILL.md (PM 详细执行手册)"
echo "  - $SCRIPT_DIR/docs/USAGE.md (使用指南)"
echo "  - $SCRIPT_DIR/examples/wuhan-o2o/ (实战案例：武汉医药O2O战略报告)"
