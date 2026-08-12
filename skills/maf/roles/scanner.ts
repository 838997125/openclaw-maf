/**
 * 角色库扫描器（v2.3.1）
 *
 * 从 agency-agents-zh/AGENT-LIST.md 解析所有可用角色，并通过**扫描文件系统**
 * 建立 id → 文件路径的真实映射，避免硬编码前缀表随角色库演进而失效。
 *
 * v2.3.1 修复：
 *  - 新版角色库（2026-08）新增 gis/security/strategy/integrations 顶层目录，
 *    游戏开发拆成 unity/unreal-engine/godot/roblox-studio/blender 子目录，
 *    空间计算 id 前缀（xr-/visionos-/macos-）与目录名不一致。
 *    旧版纯前缀 replace 会给 103/267 个角色拼出不存在的文件路径。
 *  - 改为启动时扫描 AGENTS_DIR 下所有 *.md（跳过 .git/.github/node_modules/examples/integrations/assets），
 *    用文件名（去 .md）作 key 建立 id→相对路径反查表，彻底告别前缀维护。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, extname } from 'node:path';
import { homedir } from 'node:os';

export interface RoleEntry {
  id: string;           // agent ID 如 "marketing-douyin-strategist"
  name: string;         // 中文名 如 "抖音策略师"
  description: string;  // 角色描述
  department: string;   // 部门分类 如 "营销部 / 国内平台"
  rolePath: string;     // 相对 AGENTS_DIR 的无扩展名路径，如 "marketing/douyin-strategist"
  source: '翻译' | '原创';
}

const AGENTS_DIR = process.env.AGENCY_AGENTS_HOME
  || resolve(homedir(), 'agency-agents-zh');
const AGENT_LIST_PATH = resolve(AGENTS_DIR, 'AGENT-LIST.md');

// 不扫描的目录（非角色目录）
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'assets', 'examples', 'integrations', 'scripts']);

/**
 * 扫描 AGENTS_DIR 下所有 *.md，建立 id(不含扩展名) → 相对路径(不含扩展名) 映射。
 * 例如 "marketing/douyin-strategist" → 完整文件 marketing/douyin-strategist.md
 */
function buildRolePathIndex(root: string): Map<string, string> {
  const index = new Map<string, string>();
  if (!existsSync(root)) return index;

  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile() && extname(name) === '.md') {
        const id = name.replace(/\.md$/, '');
        // AGENT-LIST.md / README.md / QUICKSTART.md / EXECUTIVE-BRIEF.md 等非角色文件跳过
        if (id.toUpperCase() === 'AGENT-LIST' || id.toUpperCase() === 'README'
          || id.toUpperCase() === 'QUICKSTART' || id.toUpperCase() === 'EXECUTIVE-BRIEF'
          || id.toUpperCase() === 'CATALOG' || id.toUpperCase() === 'CONTRIBUTING'
          || id.toUpperCase() === 'UPSTREAM' || id.toUpperCase() === 'LICENSE') continue;
        const rel = relative(root, full).replace(/\\/g, '/').replace(/\.md$/, '');
        // 同名时先到先得（角色库中应无重名）
        if (!index.has(id)) index.set(id, rel);
      }
    }
  };
  walk(root);
  return index;
}

// 启动时建立一次缓存
const ROLE_PATH_INDEX = buildRolePathIndex(AGENTS_DIR);

/**
 * 兜底：如果文件系统扫描没命中（极端情况，例如角色只在 AGENT-LIST 中登记但文件缺失），
 * 用旧版前缀替换逻辑猜一个路径。保留以防万一。
 */
function fallbackRolePath(id: string): string {
  return id
    .replace(/^marketing-/, 'marketing/')
    .replace(/^engineering-/, 'engineering/')
    .replace(/^finance-/, 'finance/')
    .replace(/^product-/, 'product/')
    .replace(/^project-management-/, 'project-management/')
    .replace(/^design-/, 'design/')
    .replace(/^sales-/, 'sales/')
    .replace(/^legal-/, 'legal/')
    .replace(/^hr-/, 'hr/')
    .replace(/^supply-chain-/, 'supply-chain/')
    .replace(/^testing-/, 'testing/')
    .replace(/^support-/, 'support/')
    .replace(/^paid-media-/, 'paid-media/')
    .replace(/^academic-/, 'academic/')
    .replace(/^game-development-/, 'game-development/')
    // v2.3.1 新增前缀
    .replace(/^gis-/, 'gis/')
    .replace(/^security-/, 'security/')
    .replace(/^unity-/, 'game-development/unity/')
    .replace(/^unreal-/, 'game-development/unreal-engine/')
    .replace(/^godot-/, 'game-development/godot/')
    .replace(/^roblox-/, 'game-development/roblox-studio/')
    .replace(/^blender-/, 'game-development/blender/')
    .replace(/^level-/, 'game-development/')
    .replace(/^narrative-/, 'game-development/')
    .replace(/^game-/, 'game-development/')
    .replace(/^technical-artist$/, 'game-development/technical-artist')
    .replace(/^xr-/, 'spatial-computing/')
    .replace(/^visionos-/, 'spatial-computing/')
    .replace(/^macos-/, 'spatial-computing/')
    .replace(/^terminal-integration/, 'spatial-computing/terminal-integration');
}

/**
 * 解析 AGENT-LIST.md，提取所有角色
 */
export function scanAllRoles(): RoleEntry[] {
  if (!existsSync(AGENT_LIST_PATH)) {
    throw new Error(`角色列表不存在: ${AGENT_LIST_PATH}`);
  }
  const content = readFileSync(AGENT_LIST_PATH, 'utf-8');
  const roles = parseAgentList(content);

  // 文件系统扫描覆盖后，为每个角色填入真实 rolePath；找不到的用兜底并打 warning
  let missing = 0;
  for (const r of roles) {
    const real = ROLE_PATH_INDEX.get(r.id);
    if (real) {
      r.rolePath = real;
    } else {
      r.rolePath = fallbackRolePath(r.id);
      missing++;
    }
  }
  if (missing > 0) {
    // 不抛错——角色可能登记了但文件未同步；让 PM 在实际加载时再报错
    console.warn(`[maf/scanner] 警告：${missing} 个角色在文件系统中未找到对应 .md，使用兜底路径。`);
  }
  return roles;
}

/**
 * 按部门分类扫描角色
 */
export function scanRolesByDepartment(): Map<string, RoleEntry[]> {
  const allRoles = scanAllRoles();
  const byDept = new Map<string, RoleEntry[]>();
  for (const role of allRoles) {
    if (!byDept.has(role.department)) byDept.set(role.department, []);
    byDept.get(role.department)!.push(role);
  }
  return byDept;
}

/**
 * 解析 AGENT-LIST.md 内容
 */
function parseAgentList(content: string): RoleEntry[] {
  const roles: RoleEntry[] = [];
  const lines = content.split('\n');
  let currentDept = '';

  for (const line of lines) {
    // 二级标题：## 工程部 (Engineering)
    const deptMatch = line.match(/^##\s+(.+?)(?:\s*\(\d+\))?\s*$/);
    if (deptMatch) {
      currentDept = normalizeDeptName(deptMatch[1].trim());
      continue;
    }
    // 三级标题：### 国内平台  → 作为子部门名，拼接到 currentDept
    const subDeptMatch = line.match(/^###\s+(.+)$/);
    if (subDeptMatch) {
      // 保留顶层部门前缀，方便 TASK_TYPE_TO_DEPT 同时匹配"营销部"和"国内平台"
      // currentDept 类似 "营销部"，子部门类似 "国内平台"，我们直接用子部门名，
      // 但 TASK_TYPE_TO_DEPT 里写的是子部门名，所以用子部门即可；顶层也保留一个带斜杠的形式可选。
      currentDept = subDeptMatch[1].trim();
      continue;
    }
    // 角色表格行：| `id` | 中文名 | 描述 | 来源 |
    const tableMatch = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(翻译|原创)\s*\|/);
    if (tableMatch && currentDept) {
      const id = tableMatch[1].trim();
      const name = tableMatch[2].trim();
      const description = tableMatch[3].trim();
      const source = tableMatch[4].trim() as '翻译' | '原创';
      // rolePath 后续在 scanAllRoles 里用文件系统索引覆盖
      roles.push({
        id, name, description,
        department: currentDept,
        rolePath: fallbackRolePath(id),
        source,
      });
    }
  }
  return roles;
}

/**
 * 规范化部门名：去掉尾部英文括号说明
 * "工程部 (Engineering)" → "工程部"
 */
function normalizeDeptName(dept: string): string {
  return dept.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * 获取单个角色的 system prompt 文件绝对路径
 */
export function getRoleSystemPromptPath(rolePath: string): string {
  return resolve(AGENTS_DIR, `${rolePath}.md`);
}

/**
 * 加载单个角色的 system prompt
 */
export function loadRoleSystemPrompt(rolePath: string): string {
  const filePath = getRoleSystemPromptPath(rolePath);
  if (!existsSync(filePath)) {
    throw new Error(`角色文件不存在: ${filePath}`);
  }
  return readFileSync(filePath, 'utf-8');
}

/** 暴露路径常量供外部诊断 */
export const ROLES_DIR = AGENTS_DIR;
export const ROLE_PATHS_INDEXED = ROLE_PATH_INDEX.size;

// ── 角色快速匹配表 ──────────────────────────────────────

// 部门名使用 AGENT-LIST.md 规范化后的中文名。
// 新版角色库把原「营销部」拆成了「国内平台 / 出海营销 / 通用」三个子部门；
// 新增「GIS 部」「安全部」；游戏开发拆成 Unity/Unreal/Blender/Godot/Roblox Studio。
export const TASK_TYPE_TO_DEPT: Record<string, string[]> = {
  '市场分析': ['国内平台', '出海营销', '通用', '付费媒体部'],
  '竞品研究': ['专项部', '国内平台', '出海营销'],
  '技术方案': ['工程部', '安全部'],
  '财务预测': ['金融部'],
  '运营策略': ['国内平台', '出海营销', '通用', '销售部'],
  '用户体验': ['设计部'],
  '合规审核': ['法务部', '安全部'],
  '供应链': ['供应链部'],
  '人力资源': ['人力资源部'],
  '项目管理': ['项目管理部'],
  '产品设计': ['设计部', '产品部'],
  '数据埋点/分析': ['工程部', '支持部', 'GIS 部'],
  '内容创作': ['国内平台', '出海营销', '通用'],
  '增长获客': ['国内平台', '出海营销', '通用', '销售部'],
  '法律合同': ['法务部'],
  '招聘': ['人力资源部'],
  '测试/质量': ['测试部'],
  '嵌入式/硬件': ['工程部', '空间计算部'],
  '出海/跨境': ['出海营销', '付费媒体部'],
  '抖音/短视频': ['国内平台'],
  '小红书': ['国内平台'],
  'B站': ['国内平台'],
  '电商/淘宝天猫拼多多': ['国内平台'],
  '私域/企微': ['国内平台'],
  '直播带货': ['国内平台'],
  '飞书/钉钉集成': ['工程部'],
  '游戏开发': ['Unity', 'Unreal Engine', 'Blender', 'Godot', 'Roblox Studio'],
  '3D建模/动画': ['Blender', 'Unity', 'Unreal Engine'],
  '学术/论文': ['学术部'],
  '地图/GIS': ['GIS 部'],
  'AR/VR/空间计算': ['空间计算部'],
  '网络安全': ['安全部'],
  // v2.3.1 补充：战略/商业规划
  '战略规划': ['专项部', '项目管理部'],
  '商业计划': ['专项部', '金融部'],
};

/**
 * 根据任务关键词匹配推荐角色
 */
export function matchRolesByKeywords(keywords: string[]): RoleEntry[] {
  const allRoles = scanAllRoles();
  const matched: RoleEntry[] = [];
  const seen = new Set<string>();

  for (const kw of keywords) {
    for (const [taskType, depts] of Object.entries(TASK_TYPE_TO_DEPT)) {
      if (taskType.includes(kw) || kw.includes(taskType)) {
        for (const dept of depts) {
          for (const role of allRoles) {
            if (normalizeDeptName(role.department) === dept && !seen.has(role.id)) {
              matched.push(role);
              seen.add(role.id);
            }
          }
        }
      }
    }
  }
  return matched;
}
