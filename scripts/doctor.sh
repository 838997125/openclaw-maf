#!/usr/bin/env bash
# MAF doctor — verify all dependencies before running a multi-agent task.
set -u

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
PM_WORKSPACE="${PM_WORKSPACE:-$OPENCLAW_HOME/workspace-pm}"
AGENCY_AGENTS_HOME="${AGENCY_AGENTS_HOME:-$HOME/agency-agents-zh}"
ANYSEARCH_HOME="${ANYSEARCH_HOME:-$OPENCLAW_HOME/workspace/skills/anysearch}"

ok=0; warn=0; fail=0
check() { # status message
  case "$1" in
    ok)   echo "✅ $2"; ok=$((ok+1));;
    warn) echo "⚠️  $2"; warn=$((warn+1));;
    fail) echo "❌ $2"; fail=$((fail+1));;
  esac
}

echo "=== MAF v2.3 doctor ==="
echo "OPENCLAW_HOME      = $OPENCLAW_HOME"
echo "PM_WORKSPACE       = $PM_WORKSPACE"
echo "AGENCY_AGENTS_HOME = $AGENCY_AGENTS_HOME"
echo "ANYSEARCH_HOME     = $ANYSEARCH_HOME"
echo ""

echo "--- OpenClaw ---"
[ -d "$OPENCLAW_HOME" ] && check ok "OpenClaw home exists" || check fail "OpenClaw home not found at $OPENCLAW_HOME"
[ -d "$PM_WORKSPACE" ] && check ok "PM workspace exists" || check fail "PM workspace not found (run install.sh first)"

echo ""
echo "--- MAF skill ---"
[ -f "$PM_WORKSPACE/skills/maf/SKILL.md" ] && check ok "skills/maf/SKILL.md present" || check fail "skills/maf/SKILL.md missing (run install.sh)"
if [ -f "$PM_WORKSPACE/skills/maf/SKILL.md" ]; then
  grep -q "v2.3" "$PM_WORKSPACE/skills/maf/SKILL.md" && check ok "MAF version is v2.3" || check warn "MAF version not marked v2.3"
fi
[ -d "$PM_WORKSPACE/skills/maf/mea" ] && check ok "MEA templates (mea/) present" || check fail "MEA templates missing"
[ -f "$PM_WORKSPACE/skills/maf-trigger/SKILL.md" ] && check ok "maf-trigger skill present" || check warn "maf-trigger skill missing"

echo ""
echo "--- PM workspace personality ---"
for f in AGENTS.md SOUL.md IDENTITY.md TOOLS.md; do
  if [ -f "$PM_WORKSPACE/$f" ]; then check ok "$f present"; else check warn "$f missing (PM may not know its role)"; fi
done

echo ""
echo "--- 215-role agent library ---"
if [ -f "$AGENCY_AGENTS_HOME/AGENT-LIST.md" ]; then
  check ok "AGENT-LIST.md found"
  roles=$(grep -cE '^\| `[a-z0-9-]+`' "$AGENCY_AGENTS_HOME/AGENT-LIST.md" 2>/dev/null || echo 0)
  check ok "~$roles roles indexed"
else
  check fail "Role library missing at $AGENCY_AGENTS_HOME (run install.sh — a copy is bundled in vendor/agency-agents-zh)"
fi
# auditor role specifically
for aud in testing-reality-checker testing-evidence-collector; do
  f=$(find "$AGENCY_AGENTS_HOME" -name "${aud}.md" 2>/dev/null | head -1)
  [ -n "$f" ] && check ok "Auditor role: $aud" || check fail "Auditor role missing: $aud (MEA requires it)"
done

echo ""
echo "--- AnySearch (web research) ---"
if [ -f "$ANYSEARCH_HOME/scripts/anysearch_cli.py" ]; then
  check ok "AnySearch CLI found"
  python3 "$ANYSEARCH_HOME/scripts/anysearch_cli.py" doc >/dev/null 2>&1 && check ok "AnySearch responds to 'doc'" || check warn "AnySearch installed but 'doc' failed (may need API key or deps)"
else
  check warn "AnySearch not found at $ANYSEARCH_HOME — install with: clawhub install anysearch, or set ANYSEARCH_HOME"
fi

echo ""
echo "--- Network / git ---"
command -v git >/dev/null && check ok "git available" || check fail "git missing"
command -v python3 >/dev/null && check ok "python3 available" || check fail "python3 missing"

echo ""
echo "=== Summary: $ok ok, $warn warnings, $fail failures ==="
if [ "$fail" -gt 0 ]; then
  echo "❌ Doctor found blocking issues. Fix them before running MAF."
  exit 1
elif [ "$warn" -gt 0 ]; then
  echo "⚠️  MAF can run, but review warnings above."
  exit 0
else
  echo "✅ All checks passed — ready to run MAF."
  exit 0
fi
